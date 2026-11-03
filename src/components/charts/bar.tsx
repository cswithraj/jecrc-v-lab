"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Single-series bar chart (one hue: the institution's primary). One series → no legend; the card title names it.
 * Thin bars with 4px rounded data-ends, recessive grid, hover tooltip, and an accessible table fallback.
 */
export function BarChartCard({ data, unit = "", max, height = 260, horizontal = false, label }: { data: { label: string; value: number; hint?: string }[]; unit?: string; max?: number; height?: number; horizontal?: boolean; label: string }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>;
  return (
    <figure>
      <div style={{ height: horizontal ? Math.max(160, data.length * 30 + 40) : height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 4, left: horizontal ? 8 : -12 }} barCategoryGap={horizontal ? 6 : "22%"}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="0" vertical={horizontal} horizontal={!horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" domain={[0, max ?? "auto"]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit={unit} />
                <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis domain={[0, max ?? "auto"]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit={unit} />
              </>
            )}
            <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
              formatter={(v: number, _n, p) => [`${v}${unit}`, (p?.payload as { hint?: string })?.hint ?? label]} labelStyle={{ fontWeight: 600 }} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 18 : 28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer">View as table</summary>
        <table className="mt-1 w-full"><tbody>{data.map((d) => <tr key={d.label} className="border-b"><td className="py-1 pr-2">{d.hint ?? d.label}</td><td className="py-1 text-right tabular-nums">{d.value}{unit}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}
