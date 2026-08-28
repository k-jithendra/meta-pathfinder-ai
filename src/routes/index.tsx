import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Atom,
  Cpu,
  Download,
  Flag,
  Loader2,
  MapPin,
  Play,
  Repeat,
  Shuffle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AlgorithmPanel } from "@/components/traffic/AlgorithmPanel";
import { DataSourcePanel } from "@/components/traffic/DataSourcePanel";
import { IncidentFeed } from "@/components/traffic/IncidentFeed";
import { MetricsRow } from "@/components/traffic/MetricsRow";
import { NetworkMap } from "@/components/traffic/NetworkMap";
import { RouteComparison } from "@/components/traffic/RouteComparison";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { makeIncident, type Incident } from "@/lib/traffic/datasources";
import { edges, nodes, simulateNetwork } from "@/lib/traffic/network";
import {
  DEFAULT_PARAMS,
  optimizeRoute,
  type Objective,
  type SolverParams,
} from "@/lib/traffic/optimizer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuantumFlow · Quantum-Inspired Traffic Route Optimization (SIH26137)" },
      {
        name: "description",
        content:
          "Interactive SIH26137 prototype: quantum-inspired metaheuristic route optimization over a live-ready Indian city traffic network with ETA, congestion, emissions and signal-wait analytics.",
      },
      { property: "og:title", content: "QuantumFlow · Quantum-Inspired Traffic Route Optimization" },
      {
        property: "og:description",
        content:
          "SIH26137 prototype — QIEA route optimizer with live-ready OpenStreetMap and traffic-provider adapters, explainable algorithm panel and incident-aware re-routing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const OBJECTIVES: Array<{ value: Objective; label: string; hint: string }> = [
  { value: "balanced", label: "Balanced (time + emissions + signals)", hint: "City-scale policy default" },
  { value: "time", label: "Fastest arrival", hint: "Emergency & ambulance corridors" },
  { value: "emissions", label: "Lowest emissions", hint: "Clean-air / EV fleet mode" },
];

function formatClock(minuteOfDay: number) {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = Math.floor(minuteOfDay % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function Dashboard() {
  const [source, setSource] = useState("N14");
  const [target, setTarget] = useState("N16");
  const [minuteOfDay, setMinuteOfDay] = useState(9 * 60 + 30);
  const [demandScale, setDemandScale] = useState(1);
  const [objective, setObjective] = useState<Objective>("balanced");
  const [population, setPopulation] = useState(DEFAULT_PARAMS.populationSize);
  const [iterations, setIterations] = useState(DEFAULT_PARAMS.iterations);
  const [tunnelRate, setTunnelRate] = useState(DEFAULT_PARAMS.tunnelRate);
  const [adaptiveSignals, setAdaptiveSignals] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [tick, setTick] = useState(1);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [solving, setSolving] = useState(false);
  const [runId, setRunId] = useState(0);

  // Live clock: advances the simulated minute + refreshes the flow field.
  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setMinuteOfDay((m) => (m + 2) % 1440);
    }, 2500);
    return () => clearInterval(id);
  }, [liveMode]);

  const state = useMemo(
    () =>
      simulateNetwork({
        minuteOfDay,
        demandScale,
        incidents: incidents.map((i) => i.edgeId),
        tick,
        adaptiveSignals,
      }),
    [minuteOfDay, demandScale, incidents, tick, adaptiveSignals],
  );

  const params: SolverParams = useMemo(
    () => ({
      populationSize: population,
      iterations,
      theta: DEFAULT_PARAMS.theta,
      tunnelRate,
      objective,
      seed: DEFAULT_PARAMS.seed + runId,
    }),
    [population, iterations, tunnelRate, objective, runId],
  );

  const result = useMemo(
    () => optimizeRoute(source, target, state, params),
    [source, target, state, params],
  );

  const injectIncident = useCallback(() => {
    const pick = edges[Math.floor(Math.random() * edges.length)]!;
    setIncidents((prev) => [
      makeIncident(pick.id, pick.name, Math.floor(Math.random() * 997)),
      ...prev,
    ].slice(0, 12));
  }, []);

  // Ambient incident stream while live mode is on.
  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => {
      if (Math.random() < 0.55) injectIncident();
    }, 7000);
    return () => clearInterval(id);
  }, [liveMode, injectIncident]);

  const runOptimizer = () => {
    setSolving(true);
    setRunId((r) => r + 1);
    setTimeout(() => setSolving(false), 850);
  };

  // Map click: first click sets the destination, clicking the current
  // destination promotes it to the source so a demo can chain hops quickly.
  const pickNode = (id: string) => {
    if (id === source) return;
    if (id === target) {
      setSource(id);
      setTarget(source);
      return;
    }
    setTarget(id);
  };

  const etaSaved = result.baseline.metrics.etaMin - result.optimized.metrics.etaMin;
  const co2Saved = (result.baseline.metrics.emissionsG - result.optimized.metrics.emissionsG) / 1000;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 py-6 lg:px-8">
      <header className="panel flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Atom className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Smart India Hackathon 2026 · Problem SIH26137
            </p>
            <h1 className="text-xl font-semibold leading-tight lg:text-2xl">
              QuantumFlow — Quantum-Inspired Intelligent Traffic Route Optimization
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground lg:text-[13px]">
              A quantum-inspired evolutionary metaheuristic re-routes city traffic in real time across a
              live-ready OpenStreetMap graph, co-optimising travel time, signal wait and tailpipe emissions.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Network clock</p>
            <p className="text-mono text-lg font-semibold">{formatClock(minuteOfDay)}</p>
          </div>
          <div className="rounded-lg border border-flow-free/40 bg-flow-free/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-flow-free">Time saved</p>
            <p className="text-mono text-lg font-semibold text-flow-free">
              {etaSaved > 0 ? "-" : "+"}
              {Math.abs(etaSaved).toFixed(1)} min
            </p>
          </div>
          <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-accent">CO₂ avoided</p>
            <p className="text-mono text-lg font-semibold text-accent">{co2Saved.toFixed(2)} kg</p>
          </div>
          <a
            href="/sih26137-quantumflow-deck.pptx"
            download
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" /> SIH deck (.pptx)
          </a>
        </div>
      </header>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          <MetricsRow baseline={result.baseline.metrics} optimized={result.optimized.metrics} />

          <div className="panel p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[190px] flex-1">
                <Label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-flow-free" /> Source junction
                </Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((n) => (
                      <SelectItem key={n.id} value={n.id} disabled={n.id === target}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="mb-0.5"
                aria-label="Swap source and destination"
                onClick={() => {
                  setSource(target);
                  setTarget(source);
                }}
              >
                <Repeat className="h-4 w-4" />
              </Button>
              <div className="min-w-[190px] flex-1">
                <Label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Flag className="h-3.5 w-3.5 text-primary" /> Destination junction
                </Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((n) => (
                      <SelectItem key={n.id} value={n.id} disabled={n.id === source}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[230px] flex-1">
                <Label className="mb-1.5 block text-xs text-muted-foreground">Optimisation objective</Label>
                <Select value={objective} onValueChange={(v) => setObjective(v as Objective)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OBJECTIVES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runOptimizer} className="mb-0.5 font-semibold" disabled={solving}>
                {solving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
                {solving ? "Collapsing register…" : "Run optimiser"}
              </Button>
            </div>
          </div>

          <NetworkMap
            state={state}
            baseline={result.baseline}
            optimized={result.optimized}
            alternatives={result.alternatives}
            source={source}
            target={target}
            showBaseline={showBaseline}
            onPickNode={pickNode}
          />

          <Tabs defaultValue="compare">
            <TabsList>
              <TabsTrigger value="compare">Route comparison</TabsTrigger>
              <TabsTrigger value="algorithm">Explainable algorithm</TabsTrigger>
              <TabsTrigger value="data">Live data integration</TabsTrigger>
            </TabsList>
            <TabsContent value="compare" className="mt-3">
              <RouteComparison result={result} />
            </TabsContent>
            <TabsContent value="algorithm" className="mt-3">
              <AlgorithmPanel result={result} params={params} />
            </TabsContent>
            <TabsContent value="data" className="mt-3">
              <DataSourcePanel />
            </TabsContent>
          </Tabs>
        </section>

        <aside className="space-y-4">
          <div className="panel space-y-4 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Cpu className="h-4 w-4 text-accent" /> Optimisation controls
            </h3>

            <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium">Live network mode</p>
                <p className="text-[10.5px] text-muted-foreground">Streams flow + incidents every few seconds</p>
              </div>
              <Switch checked={liveMode} onCheckedChange={setLiveMode} aria-label="Live network mode" />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <Label className="text-muted-foreground">Time of day</Label>
                <span className="text-mono">{formatClock(minuteOfDay)}</span>
              </div>
              <Slider
                className="mt-2"
                value={[minuteOfDay]}
                min={0}
                max={1439}
                step={5}
                onValueChange={([v]) => setMinuteOfDay(v ?? 0)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <Label className="text-muted-foreground">Demand load (events / monsoon)</Label>
                <span className="text-mono">{demandScale.toFixed(2)}×</span>
              </div>
              <Slider
                className="mt-2"
                value={[demandScale * 100]}
                min={50}
                max={150}
                step={5}
                onValueChange={([v]) => setDemandScale((v ?? 100) / 100)}
              />
            </div>

            <div className="h-px bg-border" />

            <div>
              <div className="flex items-center justify-between text-xs">
                <Label className="text-muted-foreground">Population (qubit registers)</Label>
                <span className="text-mono">{population}</span>
              </div>
              <Slider className="mt-2" value={[population]} min={8} max={64} step={4} onValueChange={([v]) => setPopulation(v ?? 28)} />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <Label className="text-muted-foreground">Iterations</Label>
                <span className="text-mono">{iterations}</span>
              </div>
              <Slider className="mt-2" value={[iterations]} min={10} max={140} step={10} onValueChange={([v]) => setIterations(v ?? 60)} />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <Label className="text-muted-foreground">Tunnelling rate p</Label>
                <span className="text-mono">{tunnelRate.toFixed(2)}</span>
              </div>
              <Slider
                className="mt-2"
                value={[tunnelRate * 100]}
                min={0}
                max={50}
                step={2}
                onValueChange={([v]) => setTunnelRate((v ?? 18) / 100)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium">Adaptive signal co-optimisation</p>
                <p className="text-[10.5px] text-muted-foreground">Green-wave splits from the ATCS adapter</p>
              </div>
              <Switch checked={adaptiveSignals} onCheckedChange={setAdaptiveSignals} aria-label="Adaptive signal co-optimisation" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium">Overlay classic route</p>
                <p className="text-[10.5px] text-muted-foreground">Dijkstra shortest-distance baseline</p>
              </div>
              <Switch checked={showBaseline} onCheckedChange={setShowBaseline} aria-label="Overlay classic route" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={injectIncident}>
                <Zap className="mr-1.5 h-3.5 w-3.5" /> Inject incident
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const a = nodes[Math.floor(Math.random() * nodes.length)]!;
                  let b = nodes[Math.floor(Math.random() * nodes.length)]!;
                  while (b.id === a.id) b = nodes[Math.floor(Math.random() * nodes.length)]!;
                  setSource(a.id);
                  setTarget(b.id);
                }}
              >
                <Shuffle className="mr-1.5 h-3.5 w-3.5" /> Random OD pair
              </Button>
            </div>
          </div>

          <div className="panel p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-accent" /> Network health
            </h3>
            <dl className="mt-3 space-y-2 text-xs">
              {[
                ["Junctions monitored", `${nodes.length}`],
                ["Road links modelled", `${edges.length}`],
                [
                  "Links above 70% jam factor",
                  `${Object.values(state.edges).filter((e) => e.congestion > 0.7).length}`,
                ],
                [
                  "Mean city jam factor",
                  `${(
                    (Object.values(state.edges).reduce((a, e) => a + e.congestion, 0) /
                      Math.max(1, Object.keys(state.edges).length)) *
                    100
                  ).toFixed(0)}%`,
                ],
                ["Active incidents", `${incidents.length}`],
                ["Solver evaluations (last run)", `${result.evaluations}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-border/50 pb-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-mono font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <IncidentFeed
            incidents={incidents}
            onClear={() => setIncidents([])}
            onFocus={(edgeId) => {
              const e = edges.find((x) => x.id === edgeId);
              if (!e) return;
              setSource(e.from);
              setTarget(e.to === e.from ? target : "N19");
            }}
            affectedEdgeIds={result.optimized.edgeIds}
          />
        </aside>
      </div>

      <footer className="mt-6 panel flex flex-wrap items-center justify-between gap-3 p-4 text-[11px] text-muted-foreground">
        <p>
          QuantumFlow prototype · SIH26137 · Quantum-inspired evolutionary optimisation on classical hardware,
          QAOA/annealing-ready. All figures shown are produced by the on-device simulation model unless a live
          adapter secret is provisioned.
        </p>
        <p className="text-mono">Made for Smart India Hackathon 2026</p>
      </footer>
    </main>
  );
}
