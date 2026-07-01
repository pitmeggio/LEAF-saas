"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Link2, Check, Undo2, Wallet, Copy } from "lucide-react";
import { createCheckoutLink, markPaidManual, unmarkPaid } from "@/app/payment-actions";
import type { EssentialPayments, Payable } from "@/lib/payments/essential";

const money = (n: number, c: string) => `${c === "EUR" ? "€" : c + " "}${n.toLocaleString("it-IT")}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", timeZone: "UTC" });

export function PayablesManager({ data }: { data: EssentialPayments }) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      {/* Stripe connect banner */}
      {!data.paymentsConfigured && (
        <div className="card flex flex-wrap items-center gap-3 border-[#f59e0b]/40 bg-[#f59e0b]/8 p-4">
          <Wallet className="h-5 w-5 text-[#f59e0b]" />
          <div className="flex-1 text-sm">
            <div className="font-semibold">Stripe non collegato</div>
            <div className="text-[var(--color-muted)]">Incolla la chiave <span className="num">STRIPE_SECRET_KEY</span> (+ <span className="num">STRIPE_WEBHOOK_SECRET</span>) per far pagare online con Apple Pay, carte e Google Pay. Intanto puoi segnare gli incassi a mano qui sotto.</div>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Incassato" value={money(data.collected, data.currency)} accent />
        <Tile label="Da incassare" value={money(data.outstanding, data.currency)} />
        <Tile label="Voci" value={String(data.items.length)} />
      </div>

      {data.items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-[var(--color-muted)]">
          Nessuna voce da incassare. Le iscrizioni ai camp e le prenotazioni campi con un prezzo compaiono qui.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-2 text-left">Voce</th>
                <th className="px-4 py-2 text-left">Cliente</th>
                <th className="px-4 py-2 text-right">Importo</th>
                <th className="px-4 py-2 text-left">Stato</th>
                <th className="px-4 py-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <Row key={`${it.kind}:${it.refId}`} it={it} configured={data.paymentsConfigured} onDone={() => router.refresh()} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="kicker">{label}</div>
      <div className="num mt-1 text-2xl font-bold" style={accent ? { color: "var(--color-accent)" } : undefined}>{value}</div>
    </div>
  );
}

function Row({ it, configured, onDone }: { it: Payable; configured: boolean; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(it.checkoutUrl);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; url?: string }>, after?: (url?: string) => void) =>
    start(async () => { setErr(null); const r = await fn(); if (r.ok) { after?.(r.url); onDone(); } else setErr(r.error ?? "Errore."); });

  const copy = (url: string) => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  return (
    <tr className="border-t border-[var(--color-border)] align-middle">
      <td className="px-4 py-2.5">
        <div className="font-medium">{it.title}</div>
        <div className="text-[11px] text-[var(--color-muted)]">{it.subtitle} · {fmtDate(it.date)}</div>
      </td>
      <td className="px-4 py-2.5">
        <div>{it.customerName ?? "—"}</div>
        {it.customerEmail && <div className="text-[11px] text-[var(--color-muted)]">{it.customerEmail}</div>}
      </td>
      <td className="px-4 py-2.5 text-right num">
        {money(it.amount, it.currency)}
        {!it.paid && it.paidAmount > 0 && <div className="text-[10px] text-[var(--color-muted)]">pagato {money(it.paidAmount, it.currency)}</div>}
      </td>
      <td className="px-4 py-2.5">
        {it.paid
          ? <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]"><Check className="h-3 w-3" />Pagato</span>
          : <span className="rounded px-2 py-0.5 text-[10px] font-medium bg-[#f59e0b]/15 text-[#f59e0b]">Da pagare</span>}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          {it.paid ? (
            <button disabled={pending} onClick={() => run(() => unmarkPaid(it.kind, it.refId))} className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-50" title="Annulla incasso"><Undo2 className="h-3.5 w-3.5" /></button>
          ) : (
            <>
              {configured && (
                link
                  ? <button onClick={() => copy(link)} className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] hover:border-[var(--color-accent)]">{copied ? <><Check className="h-3.5 w-3.5" />Copiato</> : <><Copy className="h-3.5 w-3.5" />Copia link</>}</button>
                  : <button disabled={pending} onClick={() => run(() => createCheckoutLink(it.kind, it.refId), (url) => { if (url) { setLink(url); copy(url); } })} className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] hover:border-[var(--color-accent)] disabled:opacity-50"><Link2 className="h-3.5 w-3.5" />Link pagamento</button>
              )}
              <button disabled={pending} onClick={() => run(() => markPaidManual(it.kind, it.refId))} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-[#0a0c10] disabled:opacity-50" style={{ background: "var(--color-accent)" }}><CreditCard className="h-3.5 w-3.5" />Segna incassato</button>
            </>
          )}
        </div>
        {err && <div className="mt-1 text-right text-[10px] text-[#f87171]">{err}</div>}
      </td>
    </tr>
  );
}
