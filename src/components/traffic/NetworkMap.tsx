import { useMemo } from "react";

import {
  VIEW_H,
  VIEW_W,
  congestionColor,
  edges,
  nodeById,
  nodes,
  type NetworkState,
} from "@/lib/traffic/network";
import type { Route } from "@/lib/traffic/optimizer";
import { cn } from "@/lib/utils";

type Props = {
  state: NetworkState;
  baseline: Route | null;
  optimized: Route | null;
  alternatives: Route[];
  source: string;
  target: string;
  showBaseline: boolean;
  onPickNode: (id: string) => void;
};

function px(id: string) {
  const n = nodeById[id]!;
  return { x: (n.x / 1000) * VIEW_W, y: (n.y / 640) * VIEW_H };
}

function pathD(nodeSeq: string[]) {
  return nodeSeq
    .map((id, i) => {
      const p = px(id);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(" ");
}

export function NetworkMap({
  state,
  baseline,
  optimized,
  alternatives,
  source,
  target,
  showBaseline,
  onPickNode,
}: Props) {
  const geometry = useMemo(
    () =>
      edges.map((e) => {
        const a = px(e.from);
        const b = px(e.to);
        return { edge: e, a, b };
      }),
    [],
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-background/60">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" role="img" aria-label="City traffic network with live congestion">
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50 0 L0 0 0 50" fill="none" stroke="currentColor" className="text-border" strokeWidth="0.5" opacity="0.5" />
          </pattern>
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#grid)" />

        {/* Road links coloured by live congestion */}
        {geometry.map(({ edge, a, b }) => {
          const st = state.edges[edge.id]!;
          return (
            <g key={edge.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" className="text-border" strokeWidth={10} strokeLinecap="round" opacity={0.55} />
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={congestionColor(st.congestion)}
                strokeWidth={3 + st.congestion * 4}
                strokeLinecap="round"
                opacity={0.95}
              />
              {st.incident && (
                <>
                  <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={9} fill="var(--destructive)" opacity={0.85} />
                  <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={9} fill="var(--destructive)" className="pulse-ring" />
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--destructive-foreground)">
                    !
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Alternatives */}
        {alternatives.map((alt, i) => (
          <path
            key={`alt-${i}`}
            d={pathD(alt.nodes)}
            fill="none"
            stroke="var(--chart-4)"
            strokeWidth={2.5}
            strokeDasharray="2 7"
            opacity={0.7}
            strokeLinecap="round"
          />
        ))}

        {/* Baseline (classic navigator) */}
        {showBaseline && baseline && baseline.nodes.length > 1 && (
          <path
            d={pathD(baseline.nodes)}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={5}
            strokeDasharray="10 8"
            opacity={0.9}
            strokeLinecap="round"
          />
        )}

        {/* Optimised route */}
        {optimized && optimized.nodes.length > 1 && (
          <>
            <path d={pathD(optimized.nodes)} fill="none" stroke="var(--quantum)" strokeWidth={11} opacity={0.22} filter="url(#soft-glow)" strokeLinecap="round" />
            <path d={pathD(optimized.nodes)} fill="none" stroke="var(--quantum)" strokeWidth={5} strokeLinecap="round" />
            <path
              d={pathD(optimized.nodes)}
              fill="none"
              stroke="var(--background)"
              strokeWidth={2}
              strokeDasharray="6 18"
              strokeLinecap="round"
              className="route-flow"
            />
          </>
        )}

        {/* Junctions */}
        {nodes.map((n) => {
          const p = px(n.id);
          const isSource = n.id === source;
          const isTarget = n.id === target;
          const r = isSource || isTarget ? 9 : n.major ? 6 : 4.5;
          return (
            <g key={n.id} className="cursor-pointer" onClick={() => onPickNode(n.id)}>
              <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
              {(isSource || isTarget) && (
                <circle cx={p.x} cy={p.y} r={12} fill={isSource ? "var(--flow-free)" : "var(--saffron)"} className="pulse-ring" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={isSource ? "var(--flow-free)" : isTarget ? "var(--saffron)" : "var(--card)"}
                stroke={isSource || isTarget ? "var(--background)" : "var(--muted-foreground)"}
                strokeWidth={2}
              />
              <text
                x={p.x + (n.x > 820 ? -11 : 11)}
                y={p.y + 4}
                textAnchor={n.x > 820 ? "end" : "start"}
                fontSize={n.major || isSource || isTarget ? 12 : 10.5}
                className={cn(
                  "select-none",
                  isSource || isTarget ? "font-semibold" : n.major ? "font-medium" : "",
                )}
                fill={isSource || isTarget ? "var(--foreground)" : "var(--muted-foreground)"}
              >
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/90 px-3 py-2 text-[11px] text-muted-foreground">
        {[
          ["Free flow", "var(--flow-free)"],
          ["Moderate", "var(--flow-light)"],
          ["Heavy", "var(--flow-heavy)"],
          ["Gridlock", "var(--flow-jam)"],
        ].map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-5 rounded-full bg-quantum" /> Quantum-optimised
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-5 rounded-full bg-muted-foreground" /> Classic shortest path
        </span>
      </div>
    </div>
  );
}
