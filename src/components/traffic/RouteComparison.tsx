import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { nodeById } from "@/lib/traffic/network";
import type { OptimizationResult, Route } from "@/lib/traffic/optimizer";
import { cn } from "@/lib/utils";

function RouteRow({ label, route, tone, note }: { label: string; route: Route; tone: string; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold">
          <span className={cn("h-2.5 w-2.5 rounded-full", tone)} /> {label}
        </span>
        <span className="text-mono text-sm font-semibold">{route.metrics.etaMin.toFixed(1)} min</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {route.nodes.map((n) => nodeById[n]!.name).join(" → ")}
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        {[
          ["Distance", `${route.metrics.distanceKm.toFixed(1)} km`],
          ["Jam", `${(route.metrics.avgCongestion * 100).toFixed(0)}%`],
          ["Signals", `${route.metrics.signalWaitMin.toFixed(1)} min`],
          ["CO₂", `${(route.metrics.emissionsG / 1000).toFixed(2)} kg`],
        ].map(([k, v]) => (
          <span key={k}>
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span>
            <span className="text-mono">{v}</span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground/80">{note}</p>
    </div>
  );
}

export function RouteComparison({ result }: { result: OptimizationResult }) {
  const chart = [
    { name: "ETA (min)", classic: result.baseline.metrics.etaMin, quantum: result.optimized.metrics.etaMin },
    {
      name: "Signal wait (min)",
      classic: result.baseline.metrics.signalWaitMin,
      quantum: result.optimized.metrics.signalWaitMin,
    },
    {
      name: "CO₂ (100 g)",
      classic: result.baseline.metrics.emissionsG / 100,
      quantum: result.optimized.metrics.emissionsG / 100,
    },
    {
      name: "Jam (%)",
      classic: result.baseline.metrics.avgCongestion * 100,
      quantum: result.optimized.metrics.avgCongestion * 100,
    },
  ];

  return (
    <div className="panel p-4">
      <h3 className="text-sm font-semibold">Route comparison</h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="space-y-2.5">
          <RouteRow
            label="Quantum-inspired optimum"
            route={result.optimized}
            tone="bg-quantum"
            note="Selected after amplitude amplification + tunnelling over the live network state"
          />
          <RouteRow
            label="Classic shortest path"
            route={result.baseline}
            tone="bg-muted-foreground"
            note="Dijkstra on static distance — congestion and signal blind"
          />
          {result.alternatives.map((alt, i) => (
            <RouteRow
              key={i}
              label={`Distinct alternate #${i + 1}`}
              route={alt}
              tone="bg-chart-4"
              note="Kept because it overlaps the optimum by less than 72% of links"
            />
          ))}
        </div>
        <div className="h-72 rounded-lg border border-border bg-background/40 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 12, right: 8, bottom: 4, left: -20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} interval={0} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Bar dataKey="classic" name="Classic" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="quantum" name="Quantum-inspired" fill="var(--chart-1)" radius={[4, 4, 0, 0]}>
                {chart.map((_, i) => (
                  <Cell key={i} fill="var(--chart-1)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
