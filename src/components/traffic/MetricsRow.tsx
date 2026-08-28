import { ArrowDownRight, ArrowUpRight, Clock, Gauge, Leaf, TrafficCone } from "lucide-react";
import type { ReactNode } from "react";

import type { RouteMetrics } from "@/lib/traffic/optimizer";
import { cn } from "@/lib/utils";

type CardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  baseline: string;
  delta: number; // negative = improvement
  detail: string;
};

function MetricCard({ icon, label, value, unit, baseline, delta, detail }: CardProps) {
  const improved = delta < -0.05;
  const worse = delta > 0.05;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span className="text-accent">{icon}</span>
          {label}
        </span>
        <span
          className={cn(
            "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-mono",
            improved
              ? "bg-flow-free/15 text-flow-free"
              : worse
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          {improved ? <ArrowDownRight className="h-3 w-3" /> : worse ? <ArrowUpRight className="h-3 w-3" /> : null}
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}%
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold text-mono leading-none">
        {value}
        <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Classic route: <span className="text-mono text-foreground/80">{baseline}</span>
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground/80">{detail}</p>
    </div>
  );
}

function pct(base: number, next: number) {
  if (!base) return 0;
  return ((next - base) / base) * 100;
}

export function MetricsRow({
  baseline,
  optimized,
}: {
  baseline: RouteMetrics;
  optimized: RouteMetrics;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={<Clock className="h-4 w-4" />}
        label="Predicted ETA"
        value={optimized.etaMin.toFixed(1)}
        unit="min"
        baseline={`${baseline.etaMin.toFixed(1)} min`}
        delta={pct(baseline.etaMin, optimized.etaMin)}
        detail={`${optimized.distanceKm.toFixed(1)} km travelled · ${optimized.incidents} incident link(s) on path`}
      />
      <MetricCard
        icon={<Gauge className="h-4 w-4" />}
        label="Corridor congestion"
        value={(optimized.avgCongestion * 100).toFixed(0)}
        unit="%"
        baseline={`${(baseline.avgCongestion * 100).toFixed(0)}%`}
        delta={pct(baseline.avgCongestion, optimized.avgCongestion)}
        detail="Distance-weighted jam factor across the chosen links"
      />
      <MetricCard
        icon={<TrafficCone className="h-4 w-4" />}
        label="Signal wait"
        value={optimized.signalWaitMin.toFixed(1)}
        unit="min"
        baseline={`${baseline.signalWaitMin.toFixed(1)} min`}
        delta={pct(baseline.signalWaitMin, optimized.signalWaitMin)}
        detail="Cumulative stop delay at signalised intersections"
      />
      <MetricCard
        icon={<Leaf className="h-4 w-4" />}
        label="CO₂ emissions"
        value={(optimized.emissionsG / 1000).toFixed(2)}
        unit="kg"
        baseline={`${(baseline.emissionsG / 1000).toFixed(2)} kg`}
        delta={pct(baseline.emissionsG, optimized.emissionsG)}
        detail={`${optimized.fuelL.toFixed(2)} L fuel · idle-corrected urban cycle`}
      />
    </div>
  );
}
