import { AlertTriangle, Radio, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Incident } from "@/lib/traffic/datasources";
import { cn } from "@/lib/utils";

const SEVERITY: Record<Incident["severity"], string> = {
  high: "bg-destructive/15 text-destructive border-destructive/40",
  medium: "bg-flow-heavy/15 text-flow-heavy border-flow-heavy/40",
  low: "bg-flow-light/15 text-flow-light border-flow-light/40",
};

export function IncidentFeed({
  incidents,
  onClear,
  onFocus,
  affectedEdgeIds,
}: {
  incidents: Incident[];
  onClear: () => void;
  onFocus: (id: string) => void;
  affectedEdgeIds: string[];
}) {
  return (
    <div className="panel flex h-full flex-col p-4">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Radio className="h-4 w-4 animate-pulse text-destructive" /> Live incident feed
        </h3>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
          <Trash2 className="mr-1 h-3 w-3" /> Clear
        </Button>
      </header>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Simulated stream · adapter-ready for city police, MapmyIndia and citizen reports
      </p>

      <ul className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 320 }}>
        {incidents.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No active incidents. Inject one to watch the optimiser re-route in real time.
          </li>
        )}
        {incidents.map((inc) => {
          const onPath = affectedEdgeIds.includes(inc.edgeId);
          return (
            <li key={inc.id}>
              <button
                onClick={() => onFocus(inc.edgeId)}
                className="w-full rounded-lg border border-border bg-background/40 p-2.5 text-left transition-colors hover:border-accent/60"
              >
                <div className="flex items-center gap-2">
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase", SEVERITY[inc.severity])}>
                    {inc.severity}
                  </span>
                  <span className="text-xs font-medium">{inc.kind}</span>
                  {onPath && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-primary">
                      <AlertTriangle className="h-3 w-3" /> on route
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{inc.message}</p>
                <p className="mt-1 text-mono text-[10px] text-muted-foreground/70">
                  {new Date(inc.at).toLocaleTimeString("en-IN", { hour12: false })} · {inc.source}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
