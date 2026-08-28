import { Database, KeyRound, Radio, ShieldCheck } from "lucide-react";

import { DATA_SOURCES } from "@/lib/traffic/datasources";

export function DataSourcePanel() {
  return (
    <div className="panel p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Database className="h-4 w-4 text-accent" /> Data-source adapters
        </h3>
        <span className="flex items-center gap-1.5 rounded-full border border-flow-light/40 bg-flow-light/10 px-2.5 py-1 text-[11px] font-medium text-flow-light">
          <Radio className="h-3 w-3" /> Running in transparent simulation mode
        </span>
      </header>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
        Each feed is behind a single adapter interface. Provision the listed secret and the adapter flips to
        LIVE with no UI or algorithm change — the demo below is honest about which numbers are modelled.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-3 font-medium">Feed</th>
              <th className="py-2 pr-3 font-medium">Provider / endpoint</th>
              <th className="py-2 pr-3 font-medium">Cadence</th>
              <th className="py-2 pr-3 font-medium">Secret</th>
              <th className="py-2 font-medium">Demo fallback</th>
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map((s) => (
              <tr key={s.id} className="border-b border-border/50 align-top">
                <td className="py-2.5 pr-3">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{s.purpose}</p>
                </td>
                <td className="py-2.5 pr-3">
                  <p>{s.provider}</p>
                  <p className="text-mono text-[10.5px] text-muted-foreground/80">{s.endpoint}</p>
                </td>
                <td className="py-2.5 pr-3 text-mono text-[11px] text-muted-foreground">{s.cadence}</td>
                <td className="py-2.5 pr-3">
                  {s.secret ? (
                    <span className="flex items-center gap-1 text-mono text-[10.5px] text-primary">
                      <KeyRound className="h-3 w-3" /> {s.secret}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10.5px] text-flow-free">
                      <ShieldCheck className="h-3 w-3" /> none needed
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-[11px] text-muted-foreground">{s.fallback}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
