import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      signalId, 
      userLabel, 
      correctTier, 
      correctSignalType, 
      feedbackNote,
      profileName 
    } = await req.json();

    if (!signalId || !userLabel || !profileName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: signalId, userLabel, profileName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the current signal
    const { data: signal, error: signalError } = await supabase
      .from("signals")
      .select("*")
      .eq("id", signalId)
      .single();

    if (signalError || !signal) {
      return new Response(
        JSON.stringify({ success: false, error: "Signal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate confidence delta (how much the AI was off)
    let confidenceDelta = 0;
    if (correctTier && correctTier !== signal.tier) {
      // Tier was wrong - penalize confidence
      confidenceDelta = -20;
    } else if (userLabel === "correct") {
      // User confirmed AI was correct - boost confidence
      confidenceDelta = 5;
    } else if (userLabel === "irrelevant") {
      // Signal shouldn't have been captured at all
      confidenceDelta = -30;
    }

    // Insert feedback record
    const { error: feedbackError } = await supabase
      .from("signal_feedback")
      .insert({
        signal_id: signalId,
        user_label: userLabel,
        correct_tier: correctTier || null,
        correct_signal_type: correctSignalType || null,
        confidence_delta: confidenceDelta,
        feedback_note: feedbackNote || null,
        created_by: profileName,
      });

    if (feedbackError) {
      console.error("Feedback insert error:", feedbackError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save feedback" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the signal with corrections if provided
    const updates: Record<string, unknown> = {
      retrain_flag: true,
      feedback_count: (signal.feedback_count || 0) + 1,
    };

    if (correctTier) {
      updates.tier = correctTier;
    }
    if (correctSignalType) {
      updates.signal_type = correctSignalType;
    }
    if (userLabel === "irrelevant") {
      updates.is_dismissed = true;
      updates.dismissed_by = profileName;
    }

    const { error: updateError } = await supabase
      .from("signals")
      .update(updates)
      .eq("id", signalId);

    if (updateError) {
      console.error("Signal update error:", updateError);
    }

    // Update accuracy metrics for today
    const today = new Date().toISOString().split("T")[0];
    
    // Get total feedback for today
    const { count: totalFeedback } = await supabase
      .from("signal_feedback")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today);

    const { count: correctFeedback } = await supabase
      .from("signal_feedback")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today)
      .eq("user_label", "correct");

    const accuracy = totalFeedback && totalFeedback > 0 
      ? Math.round((correctFeedback || 0) / totalFeedback * 100) 
      : 0;

    await supabase
      .from("signal_accuracy_metrics")
      .upsert({
        date: today,
        region: signal.region,
        total_signals: totalFeedback || 0,
        correct_predictions: correctFeedback || 0,
        accuracy_percentage: accuracy,
      }, { onConflict: "date,region" });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Feedback recorded",
        confidenceDelta,
        newTier: correctTier || signal.tier,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Retrain error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
