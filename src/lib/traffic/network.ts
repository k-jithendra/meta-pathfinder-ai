/**
 * Traffic network model.
 *
 * Geometry + topology are deterministic so SSR and client render identically.
 * Congestion is derived from a seeded pseudo-random field plus a time-of-day
 * profile, which keeps the demo reproducible while still looking alive.
 */

export type Node = {
  id: string;
  name: string;
  x: number; // normalised 0..100 (SVG viewBox units below)
  y: number;
  major?: boolean;
};

export type Edge = {
  id: string;
  from: string;
  to: string;
  /** km */
  length: number;
  /** free-flow speed km/h */
  freeFlow: number;
  /** vehicles per hour the corridor can absorb */
  capacity: number;
  /** number of signalised intersections along the link */
  signals: number;
  name: string;
};

export type EdgeState = {
  /** 0 = free flowing, 1 = gridlock */
  congestion: number;
  /** minutes */
  travelTime: number;
  /** minutes of signal delay */
  signalDelay: number;
  incident: boolean;
};

export type NetworkState = {
  edges: Record<string, EdgeState>;
  minuteOfDay: number;
};

export const VIEW_W = 1000;
export const VIEW_H = 640;

const NODE_DEFS: Array<[string, string, number, number, boolean?]> = [
  ["N1", "Kempegowda Circle", 90, 90, true],
  ["N2", "Majestic Junction", 300, 70],
  ["N3", "Shivaji Nagar", 520, 80, true],
  ["N4", "Indiranagar Gate", 740, 95],
  ["N5", "Whitefield Ring", 920, 130, true],
  ["N6", "Rajaji Chowk", 120, 250],
  ["N7", "Vidhana Marg", 330, 230, true],
  ["N8", "MG Road Hub", 545, 240, true],
  ["N9", "Domlur Flyover", 760, 265],
  ["N10", "ITPL Corridor", 930, 320],
  ["N11", "Jayanagar 4th", 105, 420, true],
  ["N12", "Lalbagh West", 320, 400],
  ["N13", "Koramangala Sq", 555, 415, true],
  ["N14", "HSR Layout", 775, 430],
  ["N15", "Sarjapur Gate", 935, 490],
  ["N16", "Banashankari", 150, 570, true],
  ["N17", "BTM Depot", 375, 560],
  ["N18", "Silk Board", 590, 575, true],
  ["N19", "Electronic City", 800, 590, true],
];

const EDGE_DEFS: Array<[string, string, string, number, number, number, number]> = [
  // from, to, name, km, freeFlow, capacity, signals
  ["N1", "N2", "Seshadri Rd", 2.4, 45, 2600, 3],
  ["N2", "N3", "Cubbon Link", 2.6, 50, 3000, 2],
  ["N3", "N4", "Old Airport Rd", 3.1, 55, 3200, 3],
  ["N4", "N5", "Whitefield Main", 4.4, 65, 3600, 2],
  ["N1", "N6", "West Arterial", 2.0, 40, 2200, 4],
  ["N2", "N7", "Palace Cross", 2.2, 45, 2400, 3],
  ["N3", "N8", "Residency Rd", 2.1, 40, 2300, 4],
  ["N4", "N9", "Domlur Ramp", 2.3, 60, 3400, 1],
  ["N5", "N10", "ITPL Spur", 2.5, 70, 3800, 1],
  ["N6", "N7", "Mysore Rd", 2.6, 45, 2500, 3],
  ["N7", "N8", "Vidhana Ave", 2.5, 40, 2400, 5],
  ["N8", "N9", "Indira Corridor", 2.5, 50, 3000, 3],
  ["N9", "N10", "Outer Ring N", 2.4, 70, 4000, 1],
  ["N6", "N11", "Kanakapura Rd", 2.8, 50, 2700, 3],
  ["N7", "N12", "Lalbagh Rd", 2.3, 45, 2500, 3],
  ["N8", "N13", "Sony World Rd", 2.4, 45, 2600, 4],
  ["N9", "N14", "HSR Link", 2.3, 60, 3300, 2],
  ["N10", "N15", "Sarjapur Ring", 2.6, 70, 3900, 1],
  ["N11", "N12", "South Ave", 2.7, 45, 2400, 3],
  ["N12", "N13", "Hosur Cross", 2.9, 50, 2900, 4],
  ["N13", "N14", "80ft Rd", 2.6, 45, 2700, 4],
  ["N14", "N15", "Ring East", 2.2, 70, 3800, 1],
  ["N11", "N16", "Banashankari Rd", 2.0, 45, 2400, 3],
  ["N12", "N17", "BTM Feeder", 2.2, 40, 2200, 4],
  ["N13", "N18", "Silk Board Rd", 2.1, 40, 2100, 5],
  ["N14", "N19", "Hosur Highway", 3.0, 80, 4400, 1],
  ["N16", "N17", "South Ring W", 2.6, 55, 3000, 2],
  ["N17", "N18", "South Ring C", 2.5, 55, 3000, 2],
  ["N18", "N19", "NICE Link", 3.2, 80, 4200, 1],
  ["N2", "N8", "Central Diagonal", 3.4, 45, 2500, 5],
  ["N8", "N18", "Koramangala Diag", 4.0, 50, 2800, 4],
  ["N7", "N17", "Bull Temple Diag", 4.2, 50, 2700, 3],
  ["N4", "N13", "Ejipura Diag", 4.1, 55, 3000, 3],
  ["N5", "N15", "East Bypass", 4.6, 80, 4200, 0],
];

export const nodes: Node[] = NODE_DEFS.map(([id, name, x, y, major]) => ({
  id,
  name,
  x,
  y,
  ...(major ? { major: true } : {}),
}));

export const edges: Edge[] = EDGE_DEFS.map(([from, to, name, length, freeFlow, capacity, signals]) => ({
  id: `${from}-${to}`,
  from,
  to,
  name,
  length,
  freeFlow,
  capacity,
  signals,
}));

export const nodeById: Record<string, Node> = Object.fromEntries(nodes.map((n) => [n.id, n]));
export const edgeById: Record<string, Edge> = Object.fromEntries(edges.map((e) => [e.id, e]));

/** undirected adjacency: node -> [{ to, edgeId }] */
export const adjacency: Record<string, Array<{ to: string; edgeId: string }>> = (() => {
  const adj: Record<string, Array<{ to: string; edgeId: string }>> = {};
  for (const n of nodes) adj[n.id] = [];
  for (const e of edges) {
    adj[e.from]!.push({ to: e.to, edgeId: e.id });
    adj[e.to]!.push({ to: e.from, edgeId: e.id });
  }
  return adj;
})();

function hash(str: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Time-of-day demand multiplier (0.25 night .. 1.0 peak). */
export function demandProfile(minuteOfDay: number): number {
  const h = minuteOfDay / 60;
  const morning = Math.exp(-((h - 9.5) ** 2) / 3.2);
  const evening = Math.exp(-((h - 18.5) ** 2) / 4.0);
  const base = 0.28;
  return Math.min(1, base + 0.85 * Math.max(morning, evening) + 0.12 * Math.exp(-((h - 13) ** 2) / 6));
}

/** BPR-style volume/delay function. */
function bpr(freeFlowMin: number, vc: number): number {
  return freeFlowMin * (1 + 0.6 * Math.pow(vc, 3.5));
}

export type SimOptions = {
  minuteOfDay: number;
  /** 0.5 .. 1.5 global demand scaling (event / monsoon load) */
  demandScale: number;
  /** edge ids currently blocked by incidents */
  incidents: string[];
  /** epoch tick used to jitter flows so the feed feels live */
  tick: number;
  /** true when the signal-coordination co-optimisation is enabled */
  adaptiveSignals: boolean;
};

export function simulateNetwork(opts: SimOptions): NetworkState {
  const profile = demandProfile(opts.minuteOfDay) * opts.demandScale;
  const state: Record<string, EdgeState> = {};
  const incidentSet = new Set(opts.incidents);

  for (const e of edges) {
    // Core-area pressure: inner-city links carry far more demand per lane than
    // the outer ring, which is what makes the shortest-distance path a trap.
    const a = nodeById[e.from]!;
    const b = nodeById[e.to]!;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const coreDist = Math.hypot((midX - 480) / 480, (midY - 300) / 300);
    const core = 1 + 0.55 * Math.max(0, 1 - coreDist);
    const structural = (0.55 + 0.9 * hash(e.id, 7)) * core; // corridor attractiveness
    const jitter = 0.9 + 0.2 * hash(e.id, opts.tick % 997);
    let volume = e.capacity * profile * structural * jitter;
    if (incidentSet.has(e.id)) volume *= 2.1;

    const vc = volume / e.capacity;
    const freeFlowMin = (e.length / e.freeFlow) * 60;
    const runMin = bpr(freeFlowMin, vc);

    const signalBase = opts.adaptiveSignals ? 0.32 : 0.55;
    const signalDelay = e.signals * signalBase * (0.6 + 1.5 * Math.min(1.6, vc));

    state[e.id] = {
      congestion: Math.max(0, Math.min(1, (vc - 0.35) / 1.05)),
      travelTime: runMin + signalDelay,
      signalDelay,
      incident: incidentSet.has(e.id),
    };
  }

  return { edges: state, minuteOfDay: opts.minuteOfDay };
}

export function congestionColor(c: number): string {
  if (c < 0.25) return "var(--flow-free)";
  if (c < 0.5) return "var(--flow-light)";
  if (c < 0.72) return "var(--flow-heavy)";
  return "var(--flow-jam)";
}

export function congestionLabel(c: number): string {
  if (c < 0.25) return "Free flow";
  if (c < 0.5) return "Moderate";
  if (c < 0.72) return "Heavy";
  return "Gridlock";
}
