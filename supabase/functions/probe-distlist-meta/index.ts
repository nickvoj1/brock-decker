import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Reset the export fields so it re-exports with a new name
  const { error } = await supabase
    .from('enrichment_runs')
    .update({
      bullhorn_exported_at: null,
      bullhorn_list_id: null,
      bullhorn_list_name: null,
    })
    .eq('id', '2857d36c-71a0-40bf-9ccf-606edfa87311')

  return new Response(JSON.stringify({ reset: !error, error: error?.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
