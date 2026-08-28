/**
 * Route optimisation engine.
 *
 * Baseline  : Dijkstra on static distance (what a classic navigator returns).
 * Proposed   : Quantum-Inspired Evolutionary Algorithm (QIEA) over a population
 *              of feasible paths. Each candidate carries a "qubit register" of
 *              rotation angles per junction; measurement collapses the register
 *              into a concrete path, and rotation-gate updates pull the
 *              population towards the observed best while a tunnelling operator
 *              escapes local optima that classical GA/ACO get stuck in.
 *
 * The engine is deterministic given a seed so a live demo replays identically.
 */

import {
  adjacency,
  edgeById,
  edges,
  nodeById,
  type NetworkState,
} from "./network";

export type Objective = "time" | "emissions" | "balanced";

export type RouteMetrics = {
  etaMin: number;
  distanceKm: number;
  avgCongestion: number;
  signalWaitMin: number;
  /** grams CO2 */
  emissionsG: number;
  fuelL: number;
  incidents: number;
};

export type Route = {
  nodes: string[];
  edgeIds: string[];
  metrics: RouteMetrics;
  cost: number;
};

export type IterationSample = {
  iteration: number;
  best: number;
  mean: number;
  diversity: number;
  tunnels: number;
};

export type OptimizationResult = {
  baseline: Route;
  optimized: Route;
  alternatives: Route[];
  history: IterationSample[];
  evaluations: number;
  runtimeMs: number;
  converged: number;
  tunnelEvents: number;
};

export type SolverParams = {
  populationSize: number;
  iterations: number;
  /** rotation gate magnitude (exploitation) */
  theta: number;
  /** tunnelling probability (exploration) */
  tunnelRate: number;
  objective: Objective;
  seed: number;
};

export const DEFAULT_PARAMS: SolverParams = {
  populationSize: 28,
  iterations: 60,
  theta: 0.35,
  tunnelRate: 0.18,
  objective: "balanced",
  seed: 20260137,
};

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function euclid(a: string, b: string): number {
  const p = nodeById[a]!;
  const q = nodeById[b]!;
  // viewBox units -> approximate km (network spans ~26 km east-west)
  return (Math.hypot(p.x - q.x, p.y - q.y) / 100) * 2.6;
}

export function measureRoute(nodeSeq: string[], state: NetworkState): RouteMetrics {
  let etaMin = 0;
  let distanceKm = 0;
  let signalWaitMin = 0;
  let congestionWeighted = 0;
  let incidents = 0;

  for (let i = 0; i < nodeSeq.length - 1; i++) {
    const id = edgeKey(nodeSeq[i]!, nodeSeq[i + 1]!);
    const edge = edgeById[id];
    const st = state.edges[id];
    if (!edge || !st) continue;
    etaMin += st.travelTime;
    distanceKm += edge.length;
    signalWaitMin += st.signalDelay;
    congestionWeighted += st.congestion * edge.length;
    if (st.incident) incidents += 1;
  }

  const avgCongestion = distanceKm > 0 ? congestionWeighted / distanceKm : 0;
  // Idle-heavy urban duty cycle: base burn + congestion penalty + stop-start at signals
  const fuelL = distanceKm * (0.062 + 0.055 * avgCongestion) + signalWaitMin * 0.0075;
  return {
    etaMin,
    distanceKm,
    avgCongestion,
    signalWaitMin,
    emissionsG: fuelL * 2310,
    fuelL,
    incidents,
  };
}

export function edgeKey(a: string, b: string): string {
  return edgeById[`${a}-${b}`] ? `${a}-${b}` : `${b}-${a}`;
}

export function toEdgeIds(nodeSeq: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < nodeSeq.length - 1; i++) out.push(edgeKey(nodeSeq[i]!, nodeSeq[i + 1]!));
  return out;
}

export function costOf(m: RouteMetrics, objective: Objective): number {
  switch (objective) {
    case "time":
      return m.etaMin + m.incidents * 4;
    case "emissions":
      return m.emissionsG / 90 + m.etaMin * 0.25;
    default:
      return m.etaMin * 0.6 + m.emissionsG / 180 + m.signalWaitMin * 0.5 + m.incidents * 3;
  }
}

function makeRoute(nodeSeq: string[], state: NetworkState, objective: Objective): Route {
  const metrics = measureRoute(nodeSeq, state);
  return { nodes: nodeSeq, edgeIds: toEdgeIds(nodeSeq), metrics, cost: costOf(metrics, objective) };
}

/** Classic navigator baseline: shortest static distance, congestion-blind. */
export function shortestPath(
  source: string,
  target: string,
  weight: (edgeId: string) => number,
): string[] {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | undefined> = {};
  const visited = new Set<string>();
  for (const id of Object.keys(adjacency)) dist[id] = Infinity;
  dist[source] = 0;

  while (true) {
    let u: string | undefined;
    let best = Infinity;
    for (const [id, d] of Object.entries(dist)) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (!u || u === target) break;
    visited.add(u);
    for (const { to, edgeId } of adjacency[u]!) {
      if (visited.has(to)) continue;
      const nd = dist[u]! + weight(edgeId);
      if (nd < dist[to]!) {
        dist[to] = nd;
        prev[to] = u;
      }
    }
  }

  if (dist[target] === Infinity) return [];
  const path: string[] = [target];
  let cur = target;
  while (prev[cur]) {
    cur = prev[cur]!;
    path.unshift(cur);
  }
  return path[0] === source ? path : [];
}

/** Greedy stochastic walk guided by a per-node rotation register (measurement). */
function measurePath(
  source: string,
  target: string,
  register: Record<string, number>,
  rand: () => number,
  state: NetworkState,
): string[] | null {
  const path = [source];
  const seen = new Set([source]);
  let cur = source;

  for (let step = 0; step < 40; step++) {
    if (cur === target) return path;
    const options = adjacency[cur]!.filter((o) => !seen.has(o.to));
    if (options.length === 0) return null;

    // amplitude = heuristic pull toward target, damped by live congestion,
    // amplified by the candidate's learned rotation angle for this junction.
    const weights = options.map((o) => {
      const st = state.edges[o.edgeId]!;
      const heuristic = 1 / (0.4 + euclid(o.to, target));
      const flow = 1 / (0.25 + st.travelTime);
      const angle = register[`${cur}>${o.to}`] ?? Math.PI / 4;
      const amplitude = Math.sin(angle) ** 2; // |alpha|^2 probability
      return Math.pow(heuristic * flow, 1.4) * (0.15 + amplitude);
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let picked = options[options.length - 1]!;
    for (let i = 0; i < options.length; i++) {
      r -= weights[i]!;
      if (r <= 0) {
        picked = options[i]!;
        break;
      }
    }
    seen.add(picked.to);
    path.push(picked.to);
    cur = picked.to;
  }
  return null;
}

export function optimizeRoute(
  source: string,
  target: string,
  state: NetworkState,
  params: SolverParams = DEFAULT_PARAMS,
): OptimizationResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const rand = mulberry(params.seed);
  const objective = params.objective;

  const baselineNodes = shortestPath(source, target, (id) => edgeById[id]!.length);
  const baseline = makeRoute(baselineNodes, state, objective);

  // Quantum register: rotation angle per directed junction transition.
  const register: Record<string, number> = {};
  for (const e of edges) {
    register[`${e.from}>${e.to}`] = Math.PI / 4;
    register[`${e.to}>${e.from}`] = Math.PI / 4;
  }

  let population: string[][] = [];
  let evaluations = 0;
  let tunnelEvents = 0;
  const history: IterationSample[] = [];
  const seenSignature = new Map<string, Route>();

  const evaluate = (nodeSeq: string[]): Route => {
    const sig = nodeSeq.join(">");
    const cached = seenSignature.get(sig);
    if (cached) return cached;
    const r = makeRoute(nodeSeq, state, objective);
    seenSignature.set(sig, r);
    evaluations += 1;
    return r;
  };

  // Initial superposition: sample the population from the uniform register.
  let guard = 0;
  while (population.length < params.populationSize && guard < params.populationSize * 40) {
    guard += 1;
    const p = measurePath(source, target, register, rand, state);
    if (p) population.push(p);
  }
  if (baselineNodes.length) population.push(baselineNodes);
  if (population.length === 0) {
    return {
      baseline,
      optimized: baseline,
      alternatives: [],
      history: [],
      evaluations: 0,
      runtimeMs: 0,
      converged: 0,
      tunnelEvents: 0,
    };
  }

  let best = population.map(evaluate).reduce((a, b) => (a.cost < b.cost ? a : b));
  let converged = params.iterations;
  let stagnation = 0;

  for (let iter = 1; iter <= params.iterations; iter++) {
    const scored = population.map(evaluate).sort((a, b) => a.cost - b.cost);
    const iterBest = scored[0]!;
    if (iterBest.cost < best.cost - 1e-6) {
      best = iterBest;
      stagnation = 0;
    } else {
      stagnation += 1;
    }

    const mean = scored.reduce((a, r) => a + r.cost, 0) / scored.length;
    const uniquePaths = new Set(scored.map((r) => r.nodes.join(">"))).size;
    history.push({
      iteration: iter,
      best: Number(best.cost.toFixed(2)),
      mean: Number(mean.toFixed(2)),
      diversity: Number((uniquePaths / scored.length).toFixed(3)),
      tunnels: tunnelEvents,
    });

    if (stagnation >= 12 && converged === params.iterations) converged = iter;

    // Rotation gate: rotate angles on the best path towards |1>, decay others.
    const bestEdges = new Set<string>();
    for (let i = 0; i < best.nodes.length - 1; i++) bestEdges.add(`${best.nodes[i]}>${best.nodes[i + 1]}`);
    for (const key of Object.keys(register)) {
      const target1 = bestEdges.has(key) ? Math.PI / 2 - 0.05 : 0.18;
      register[key] = register[key]! + params.theta * (target1 - register[key]!);
    }

    // Next generation: elitism + measurement + quantum tunnelling mutation.
    const elite = scored.slice(0, Math.max(2, Math.floor(scored.length * 0.25))).map((r) => r.nodes);
    const next: string[][] = [...elite];
    while (next.length < params.populationSize) {
      if (rand() < params.tunnelRate) {
        // Tunnel: force a detour through a random waypoint, jumping the barrier
        // between two distinct route basins.
        tunnelEvents += 1;
        const ids = Object.keys(adjacency);
        const via = ids[Math.floor(rand() * ids.length)]!;
        const a = measurePath(source, via, register, rand, state);
        const b = a ? measurePath(via, target, register, rand, state) : null;
        if (a && b) {
          const merged = [...a, ...b.slice(1)];
          if (new Set(merged).size === merged.length) {
            next.push(merged);
            continue;
          }
        }
      }
      const p = measurePath(source, target, register, rand, state);
      if (p) next.push(p);
      else next.push(elite[0]!);
    }
    population = next;
  }

  const ranked = [...seenSignature.values()].sort((a, b) => a.cost - b.cost);
  const alternatives: Route[] = [];
  for (const r of ranked) {
    if (r.nodes.join(">") === best.nodes.join(">")) continue;
    if (alternatives.length >= 2) break;
    const overlap = r.edgeIds.filter((e) => best.edgeIds.includes(e)).length / Math.max(1, r.edgeIds.length);
    if (overlap < 0.72) alternatives.push(r);
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    baseline,
    optimized: best,
    alternatives,
    history,
    evaluations,
    runtimeMs: Math.max(1, Math.round(t1 - t0)),
    converged,
    tunnelEvents,
  };
}
