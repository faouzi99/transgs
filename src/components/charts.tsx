"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const SERIES_COLORS = ["#E08A1E", "#1C2430", "#3B7EA1", "#8FA3B8", "#B86F12", "#5A6676"];

export interface Series {
  key: string;
  label: string;
  color?: string;
}

type Row = Record<string, string | number>;

const fmt = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);

function ChartFrame({ title, height = 260, children, empty }: { title: string; height?: number; children: React.ReactElement; empty?: boolean }) {
  return (
    <div className="card">
      <h2 className="card-title">{title}</h2>
      {empty ? (
        <p className="py-10 text-center text-sm text-muted">Aucune donnée sur la période.</p>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const hasData = (data: Row[], series: Series[]) => data.some((r) => series.some((s) => Number(r[s.key]) > 0));

export function BarChartCard({
  title,
  data,
  xKey,
  series,
  unit,
  horizontal,
  height,
  stacked,
}: {
  title: string;
  data: Row[];
  xKey: string;
  series: Series[];
  unit?: string;
  horizontal?: boolean;
  height?: number;
  stacked?: boolean;
}) {
  const tooltip = (v: unknown) => `${fmt(Number(v))}${unit ? ` ${unit}` : ""}`;
  return (
    <ChartFrame title={title} height={height ?? (horizontal ? Math.max(200, data.length * 26 + 40) : 260)} empty={!hasData(data, series)}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DDE2E8" horizontal={!horizontal} vertical={!!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: "#5A6676" }} tickFormatter={fmt} />
            <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: "#1C2430" }} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#5A6676" }} interval={data.length <= 12 ? 0 : "preserveStartEnd"} />
            <YAxis tick={{ fontSize: 11, fill: "#5A6676" }} tickFormatter={fmt} width={48} />
          </>
        )}
        <Tooltip formatter={tooltip} cursor={{ fill: "#FBEBD5" }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
            stackId={stacked ? "a" : undefined}
            maxBarSize={36}
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function LineChartCard({
  title,
  data,
  xKey,
  series,
  unit,
  height,
}: {
  title: string;
  data: Row[];
  xKey: string;
  series: Series[];
  unit?: string;
  height?: number;
}) {
  const tooltip = (v: unknown) => `${fmt(Number(v))}${unit ? ` ${unit}` : ""}`;
  return (
    <ChartFrame title={title} height={height} empty={!hasData(data, series)}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DDE2E8" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#5A6676" }} />
        <YAxis tick={{ fontSize: 11, fill: "#5A6676" }} tickFormatter={fmt} width={48} />
        <Tooltip formatter={tooltip} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}
