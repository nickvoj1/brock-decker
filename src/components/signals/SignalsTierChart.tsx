import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TierChartProps {
  tierCounts: Record<string, number>;
}

const TIER_CONFIG = {
  tier_1: { name: "Tier 1", color: "#ef4444", label: "Immediate Intent" },
  tier_2: { name: "Tier 2", color: "#f59e0b", label: "Medium Intent" },
  tier_3: { name: "Tier 3", color: "#22c55e", label: "Early Interest" },
};

export function SignalsTierChart({ tierCounts }: TierChartProps) {
  const data = Object.entries(TIER_CONFIG).map(([key, config]) => ({
    name: config.name,
    label: config.label,
    count: tierCounts[key] || 0,
    color: config.color,
  }));

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Signals by Tier</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={50}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--background))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: number, name: string, props: any) => [
                `${value} signals`,
                props.payload.label,
              ]}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
