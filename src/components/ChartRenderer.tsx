import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface ChartSpec {
  chart_type: "bar" | "line" | "pie" | "area";
  title: string;
  labels: string[];
  datasets: ChartDataset[];
}

const DEFAULT_COLORS = [
  "#3699FF",
  "#8950FC",
  "#FFA800",
  "#1BC5BD",
  "#F64E60",
  "#50CD89",
  "#FF6B9D",
  "#00BCD4",
  "#FF9800",
  "#9C27B0",
];

function prepareData(spec: ChartSpec) {
  return spec.labels.map((label, i) => {
    const point: Record<string, string | number> = { label };
    spec.datasets.forEach((ds) => {
      point[ds.label] = ds.data[i] ?? 0;
    });
    return point;
  });
}

function chartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium text-foreground">
            {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function CartesianChart({
  spec,
  data,
}: {
  spec: ChartSpec;
  data: ReturnType<typeof prepareData>;
}) {
  const dataKeys = spec.datasets.map((ds) => ds.label);

  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
      <XAxis
        dataKey="label"
        axisLine={false}
        tickLine={false}
        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        interval="preserveStartEnd"
      />
      <YAxis
        axisLine={false}
        tickLine={false}
        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        width={45}
      />
      <Tooltip content={chartTooltipContent} />
      <Legend
        wrapperStyle={{ fontSize: "12px" }}
        iconType="rect"
        iconSize={8}
      />
      {spec.chart_type === "bar" &&
        dataKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={spec.datasets[i].color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      {spec.chart_type === "line" &&
        dataKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={spec.datasets[i].color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      {spec.chart_type === "area" &&
        dataKeys.map((key, i) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={spec.datasets[i].color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            fill={spec.datasets[i].color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            fillOpacity={0.15}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
    </>
  );
}

export function ChartRenderer({ spec }: { spec: ChartSpec }) {
  if (!spec || !spec.chart_type || !spec.labels?.length || !spec.datasets?.length) {
    return null;
  }

  const data = prepareData(spec);
  const type = spec.chart_type;

  return (
    <div className="my-3 rounded-xl border border-border bg-card/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground">{spec.title}</h4>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          {type === "pie" ? (
            <PieChart>
              <Pie
                data={spec.labels.map((label, i) => ({
                  name: label,
                  value: spec.datasets[0].data[i] ?? 0,
                }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                labelLine={{ strokeWidth: 1 }}
              >
                {spec.labels.map((_, i) => (
                  <Cell
                    key={i}
                    fill={spec.datasets[0].color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={chartTooltipContent} />
            </PieChart>
          ) : (
            <BarChart data={data}>
              <CartesianChart spec={spec} data={data} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
