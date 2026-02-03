import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AccuracyMetric {
  date: string;
  accuracy_percentage: number;
  total_signals: number;
  correct_predictions: number;
}

interface SignalAccuracyChartProps {
  region?: string;
}

export function SignalAccuracyChart({ region }: SignalAccuracyChartProps) {
  const [metrics, setMetrics] = useState<AccuracyMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [region]);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("signal_accuracy_metrics")
        .select("date, accuracy_percentage, total_signals, correct_predictions")
        .order("date", { ascending: true })
        .limit(30);

      if (region) {
        query = query.eq("region", region);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Type assertion since we know the shape
      setMetrics((data || []) as AccuracyMetric[]);
    } catch (error) {
      console.error("Failed to fetch accuracy metrics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate trend
  const latestAccuracy = metrics.length > 0 ? metrics[metrics.length - 1].accuracy_percentage : 0;
  const previousAccuracy = metrics.length > 1 ? metrics[metrics.length - 2].accuracy_percentage : latestAccuracy;
  const trend = latestAccuracy - previousAccuracy;

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-muted-foreground";

  // Format data for chart
  const chartData = metrics.map(m => ({
    date: new Date(m.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    accuracy: Number(m.accuracy_percentage) || 0,
    signals: m.total_signals,
  }));

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">AI Accuracy Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (metrics.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">AI Accuracy Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            No feedback data yet. Train the AI to see accuracy trends.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">AI Accuracy Trend</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {latestAccuracy.toFixed(0)}%
            </Badge>
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--background))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Accuracy"]}
            />
            <Line 
              type="monotone" 
              dataKey="accuracy" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            {metrics.reduce((sum, m) => sum + m.total_signals, 0)} signals trained
          </span>
          <span className={trendColor}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}% from last period
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
