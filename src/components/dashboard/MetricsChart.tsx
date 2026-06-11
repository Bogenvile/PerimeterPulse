import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { MetricsDataPoint } from "@/lib/types";

interface MetricsChartProps {
  data: MetricsDataPoint[];
  metric: "cpu_percent" | "ram_percent" | "storage_percent" | "network_latency_ms" | "ping_latency_ms";
  color?: string;
  height?: number;
}

const metricConfig: Record<string, { label: string; color: string; unit: string; domain: [number, number | string] }> = {
  cpu_percent: { label: "CPU %", color: "#3699FF", unit: "%", domain: [0, 100] },
  ram_percent: { label: "RAM %", color: "#8950FC", unit: "%", domain: [0, 100] },
  storage_percent: { label: "Storage %", color: "#FFA800", unit: "%", domain: [0, 100] },
  network_latency_ms: { label: "Latency ms", color: "#1BC5BD", unit: "ms", domain: [0, "auto"] as [number, number | string] },
  ping_latency_ms: { label: "Ping ms", color: "#1BC5BD", unit: "ms", domain: [0, "auto"] as [number, number | string] },
};

function formatValue(value: unknown, unit: string): string {
  const num = Number(value);
  if (isNaN(num)) return `0${unit}`;
  return `${num.toFixed(1)}${unit}`;
}

export function MetricsChart({ data, metric, color, height = 220 }: MetricsChartProps) {
  const config = metricConfig[metric];
  if (!config) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        Unknown metric: {metric}
      </div>
    );
  }

  const formattedData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        time: new Date(d.time).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    [data],
  );

  const chartColor = color || config.color;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formattedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="time"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={config.domain}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          width={40}
          unit={config.unit}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
            fontSize: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
          labelStyle={{ color: "hsl(var(--muted-foreground))", fontWeight: 500 }}
          formatter={(value: unknown) => [formatValue(value, config.unit), config.label]}
        />
        <Line
          type="monotone"
          dataKey={metric}
          stroke={chartColor}
          strokeWidth={2}
          dot={false}
          activeDot={{
            r: 4,
            fill: chartColor,
            stroke: "hsl(var(--card))",
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}