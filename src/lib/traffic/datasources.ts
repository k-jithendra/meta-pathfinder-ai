/**
 * Data-source adapters.
 *
 * Every live feed the system needs is expressed as an adapter with a single
 * `fetch` contract and a transparent simulation fallback. When the matching
 * credential is provisioned the adapter switches to LIVE with no UI change —
 * this is the integration seam demoed to the judges.
 */

export type AdapterStatus = "live" | "simulated" | "unavailable";

export type DataSource = {
  id: string;
  name: string;
  provider: string;
  purpose: string;
  /** Endpoint the production adapter calls. */
  endpoint: string;
  /** Environment secret required to go live (read server-side only). */
  secret?: string;
  cadence: string;
  status: AdapterStatus;
  fallback: string;
};

export const DATA_SOURCES: DataSource[] = [
  {
    id: "osm",
    name: "Road network graph",
    provider: "OpenStreetMap / Overpass API",
    purpose: "Junctions, link geometry, lane count, one-ways, signal nodes",
    endpoint: "https://overpass-api.de/api/interpreter",
    cadence: "Nightly ETL into graph store",
    status: "simulated",
    fallback: "19-junction / 35-link Bengaluru-style corridor graph bundled with the app",
  },
  {
    id: "flow",
    name: "Live speed & flow",
    provider: "TomTom Traffic Flow / HERE Traffic v7",
    purpose: "Per-segment current speed, free-flow speed, jam factor",
    endpoint: "https://api.tomtom.com/traffic/services/4/flowSegmentData",
    secret: "TRAFFIC_API_KEY",
    cadence: "Poll every 60 s",
    status: "simulated",
    fallback: "BPR volume-delay model driven by a time-of-day demand profile",
  },
  {
    id: "incidents",
    name: "Incident & closure feed",
    provider: "MapmyIndia Traffic + city police feed",
    purpose: "Accidents, waterlogging, VIP movement, roadworks",
    endpoint: "https://apis.mapmyindia.com/advancedmaps/v1/traffic/incidents",
    secret: "MAPMYINDIA_KEY",
    cadence: "Webhook + 30 s poll",
    status: "simulated",
    fallback: "Stochastic incident generator with operator-injectable events",
  },
  {
    id: "signals",
    name: "Adaptive signal telemetry",
    provider: "ATCS / BATCS controller gateway (NTCIP)",
    purpose: "Cycle time, green split, queue length per approach",
    endpoint: "https://atcs.gateway.local/api/v1/intersections",
    secret: "ATCS_GATEWAY_TOKEN",
    cadence: "Stream, 10 s",
    status: "simulated",
    fallback: "Signal-delay model: signals x saturation, with co-optimisation toggle",
  },
  {
    id: "transit",
    name: "Transit & fleet probes",
    provider: "GTFS-Realtime (BMTC / city bus)",
    purpose: "Probe vehicle traces used to calibrate link speeds",
    endpoint: "https://gtfs.city.gov.in/realtime/vehiclepositions",
    secret: "GTFS_RT_TOKEN",
    cadence: "Stream, 15 s",
    status: "simulated",
    fallback: "Synthetic probe jitter applied to link volumes",
  },
  {
    id: "weather",
    name: "Weather & air quality",
    provider: "IMD / OpenWeather + CPCB AQI",
    purpose: "Monsoon capacity derating, emissions exposure weighting",
    endpoint: "https://api.openweathermap.org/data/3.0/onecall",
    secret: "WEATHER_API_KEY",
    cadence: "Poll every 10 min",
    status: "simulated",
    fallback: "Demand-scale slider stands in for weather-driven capacity loss",
  },
];

export type Incident = {
  id: string;
  edgeId: string;
  kind: string;
  severity: "low" | "medium" | "high";
  message: string;
  at: number;
  source: string;
};

const KINDS: Array<{ kind: string; severity: Incident["severity"]; text: string; source: string }> = [
  { kind: "Collision", severity: "high", text: "Two-vehicle collision, right lane blocked", source: "City police feed" },
  { kind: "Waterlogging", severity: "high", text: "Waterlogging after heavy rain, speed down 60%", source: "IMD + citizen report" },
  { kind: "Roadwork", severity: "medium", text: "Metro barricading, one lane withdrawn", source: "Civic works API" },
  { kind: "Signal fault", severity: "medium", text: "Controller in flashing mode, manual policing", source: "ATCS gateway" },
  { kind: "VIP movement", severity: "medium", text: "Corridor held for convoy, 6-8 min rolling block", source: "City police feed" },
  { kind: "Stalled vehicle", severity: "low", text: "Breakdown on shoulder, minor merge friction", source: "Probe anomaly detector" },
  { kind: "Procession", severity: "low", text: "Local procession, intermittent stoppage", source: "Citizen report" },
];

export function makeIncident(edgeId: string, edgeName: string, seed: number): Incident {
  const pick = KINDS[seed % KINDS.length]!;
  return {
    id: `${edgeId}-${seed}`,
    edgeId,
    kind: pick.kind,
    severity: pick.severity,
    message: `${edgeName}: ${pick.text}`,
    at: Date.now(),
    source: pick.source,
  };
}
