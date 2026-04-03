import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(142 71% 45%)",   // green
  "hsl(0 84% 60%)",     // red
  "hsl(45 93% 47%)",    // amber
  "hsl(217 91% 60%)",   // blue
  "hsl(280 68% 60%)",   // purple
];

type BarItem = { label: string; value: number; color?: string };
type RadarItem = { metric: string; value: number; max?: number };
type PieItem = { name: string; value: number };

interface FinancialBarProps {
  title: string;
  data: BarItem[];
}

export function FinancialBar({ title, data }: FinancialBarProps) {
  const chartData = data.map((d, i) => ({
    name: d.label,
    value: d.value,
    fill: d.color || COLORS[i % COLORS.length],
  }));

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm font-medium mb-3">{title}</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number) => [`$${value}`, ""]}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface PerformanceRadarProps {
  title: string;
  data: RadarItem[];
}

export function PerformanceRadar({ title, data }: PerformanceRadarProps) {
  const chartData = data.map(d => ({
    metric: d.metric,
    value: d.value,
    fullMark: d.max || 100,
  }));

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm font-medium mb-3">{title}</p>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <PolarRadiusAxis angle={90} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
            <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface BreakdownPieProps {
  title: string;
  data: PieItem[];
}

export function BreakdownPie({ title, data }: BreakdownPieProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm font-medium mb-3">{title}</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
                color: "hsl(var(--foreground))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
