import { fmtMoney } from "@/lib/domain";
import type { SeasonPnL } from "@/lib/seasonPnL";

// Server-rendered season P&L statement. Pure presentation over getSeasonPnL.
export function SeasonPnLReport({ data }: { data: SeasonPnL }) {
  const m = (n: number) => fmtMoney(n, data.currency);
  const netPositive = data.net >= 0;

  if (!data.hasData) {
    return (
      <div className="card p-6">
        <Head season={data.season} />
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
          Ancora nessun movimento per la stagione {data.season}. Il rendiconto si popola da solo man mano che registri rette, iscrizioni ai camp, prenotazioni campi e spese.
        </div>
      </div>
    );
  }

  const peak = Math.max(1, ...data.months.map((mo) => Math.max(mo.revenue, mo.cost)));

  return (
    <div className="card p-6">
      <Head season={data.season} />

      {/* Headline net + three tiles */}
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: netPositive ? "var(--color-accent)" : "#f87171", background: netPositive ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "#f8717112" }}>
          <div className="kicker">Risultato netto</div>
          <div className="num mt-1 text-3xl font-bold" style={{ color: netPositive ? "var(--color-accent)" : "#f87171" }}>{m(data.net)}</div>
          <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">ricavi incassati − costi</div>
        </div>
        <Tile label="Ricavi incassati" value={m(data.revenue.collected)} sub={data.revenue.pending > 0 ? `+ ${m(data.revenue.pending)} da incassare` : "tutto incassato"} />
        <Tile label="Costi totali" value={m(data.cost.total)} sub="staff + spese approvate" />
        <Tile label="Margine" value={data.revenue.collected > 0 ? `${Math.round((data.net / data.revenue.collected) * 100)}%` : "—"} sub="netto / ricavi" />
      </div>

      {/* Monthly revenue vs cost */}
      <div className="mt-5 rounded-2xl border border-[var(--color-border)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="kicker">Mese per mese</div>
          <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-[var(--color-accent)]" />Ricavi</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: "#f59e0b" }} />Costi</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5" style={{ height: 120 }}>
          {data.months.map((mo, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-[96px] w-full items-end justify-center gap-0.5">
                <div className="w-1/2 rounded-t bg-[var(--color-accent)]" style={{ height: `${(mo.revenue / peak) * 100}%` }} title={`Ricavi ${m(mo.revenue)}`} />
                <div className="w-1/2 rounded-t" style={{ height: `${(mo.cost / peak) * 100}%`, background: "#f59e0b" }} title={`Costi ${m(mo.cost)}`} />
              </div>
              <span className="text-[9px] uppercase text-[var(--color-muted)]">{mo.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Breakdown title="Ricavi" lines={data.revenue.lines.map((l) => ({ label: l.label, value: l.collected, pending: l.pending }))} total={data.revenue.collected} color="var(--color-accent)" fmt={m} />
        <Breakdown title="Costi" lines={data.cost.lines.map((l) => ({ label: l.label, value: l.collected, pending: 0 }))} total={data.cost.total} color="#f59e0b" fmt={m} />
      </div>
    </div>
  );
}

function Head({ season }: { season: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div className="kicker">Rendiconto economico</div>
        <h2 className="mt-0.5 text-lg font-semibold">Stagione {season}</h2>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">aggiornato in tempo reale</span>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] p-4">
      <div className="kicker">{label}</div>
      <div className="num mt-1 text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{sub}</div>
    </div>
  );
}

function Breakdown({ title, lines, total, color, fmt }: {
  title: string; lines: { label: string; value: number; pending: number }[]; total: number; color: string; fmt: (n: number) => string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="kicker">{title}</div>
        <div className="num text-sm font-semibold">{fmt(total)}</div>
      </div>
      {lines.length === 0 ? (
        <div className="text-xs text-[var(--color-muted)]">Nessuna voce ancora.</div>
      ) : (
        <ul className="space-y-2.5">
          {lines.map((l) => (
            <li key={l.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-fg)]/85">{l.label}</span>
                <span className="num text-xs">{fmt(l.value)}{l.pending > 0 && <span className="text-[var(--color-muted)]"> · +{fmt(l.pending)} atteso</span>}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                <div className="h-full rounded-full" style={{ width: `${total > 0 ? Math.max(3, (l.value / total) * 100) : 0}%`, background: color }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
