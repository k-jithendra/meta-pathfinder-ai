import { Atom, GitBranch, Sparkles, Timer } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { edgeById, nodeById } from "@/lib/traffic/network";
import type { OptimizationResult, SolverParams } from "@/lib/traffic/optimizer";

const STAGES = [
  {
    title: "1 · Graph encoding",
    body: "Every junction transition becomes a qubit with rotation angle θ. A route is a measurement of that register, so the whole solution space lives in one compact probabilistic encoding.",
  },
  {
    title: "2 · Superposition sampling",
    body: "The initial population is measured from a uniform register — all corridors equally likely — giving broad coverage instead of one greedy guess.",
  },
  {
    title: "3 · Fitness evaluation",
    body: "Each candidate is scored on live link travel time (BPR volume-delay), signal delay, emissions and incident exposure, weighted by the selected objective.",
  },
  {
    title: "4 · Rotation gate update",
    body: "Angles along the incumbent best route rotate toward |1⟩ while the rest decay toward |0⟩ — amplitude amplification, the exploitation step.",
  },
  {
    title: "5 · Quantum tunnelling",
    body: "With probability p_tunnel a candidate is re-measured through a random waypoint, jumping the barrier between route basins that hill-climbing cannot cross.",
  },
  {
    title: "6 · Collapse & dispatch",
    body: "On convergence the register collapses to the final route; alternates below the 72% overlap threshold are kept as genuinely distinct options.",
  },
];

export function AlgorithmPanel({
  result,
  params,
}: {
  result: OptimizationResult;
  params: SolverParams;
}) {
  const improvement =
    result.baseline.cost > 0
      ? ((result.baseline.cost - result.optimized.cost) / result.baseline.cost) * 100
      : 0;

  const decisions = result.optimized.nodes.slice(0, -1).map((id, i) => {
    const next = result.optimized.nodes[i + 1]!;
    const key = edgeById[`${id}-${next}`] ? `${id}-${next}` : `${next}-${id}`;
    return {
      from: nodeById[id]!.name,
      to: nodeById[next]!.name,
      road: edgeById[key]?.name ?? key,
      inBaseline: result.baseline.edgeIds.includes(key),
    };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="panel p-4 lg:col-span-3">
        <header className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Atom className="h-4 w-4 text-accent" /> Convergence trace
          </h3>
          <span className="text-mono text-[11px] text-muted-foreground">
            {result.evaluations} evaluations · {result.runtimeMs} ms · converged @ iter {result.converged}
          </span>
        </header>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={result.history} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="fitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="iteration" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="mean" stroke="var(--chart-4)" fill="url(#fitFill)" strokeWidth={1.5} name="Population mean cost" />
              <Line type="monotone" dataKey="best" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} name="Best cost" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Objective gain", `${improvement.toFixed(1)}%`, <Sparkles key="s" className="h-3.5 w-3.5" />],
            ["Tunnel events", `${result.tunnelEvents}`, <GitBranch key="g" className="h-3.5 w-3.5" />],
            ["Population", `${params.populationSize}`, <Atom key="a" className="h-3.5 w-3.5" />],
            ["Solve time", `${result.runtimeMs} ms`, <Timer key="t" className="h-3.5 w-3.5" />],
          ].map(([label, value, icon]) => (
            <div key={label as string} className="rounded-lg border border-border bg-background/40 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span className="text-accent">{icon}</span>
                {label as string}
              </p>
              <p className="text-mono text-lg font-semibold">{value as string}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold">Why this route — decision trace</h3>
        <ol className="mt-3 space-y-1.5 text-xs">
          {decisions.map((d, i) => (
            <li key={i} className="flex items-start gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
              <span className="text-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1">
                <span className="font-medium">{d.road}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {d.from} → {d.to}
                </span>
              </span>
              <span
                className={
                  d.inBaseline
                    ? "rounded px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    : "rounded bg-quantum/15 px-1.5 py-0.5 text-[10px] font-semibold text-quantum"
                }
              >
                {d.inBaseline ? "shared" : "re-routed"}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel p-4 lg:col-span-5">
        <h3 className="text-sm font-semibold">Quantum-inspired metaheuristic — step by step</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {STAGES.map((s) => (
            <div key={s.title} className="rounded-lg border border-border bg-background/40 p-3">
              <p className="text-xs font-semibold text-accent">{s.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Runs on classical hardware — quantum <em>inspired</em>, not quantum dependent. The same operators map
          onto QAOA / annealing backends if quantum hardware becomes available, with no change to the data layer.
        </p>
      </div>
    </div>
  );
}
