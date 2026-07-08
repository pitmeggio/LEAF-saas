"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Plus, Trash2, Users, Receipt, Scale } from "lucide-react";
import { addTripMember, removeTripMember, addTripExpense, removeTripExpense } from "@/app/trip-actions";
import { EXPENSE_CAT_META, EXPENSE_CAT_ORDER, type TripDetail, type ExpenseCategory } from "@/lib/trips/tripTypes";

function money(v: number, currency: string): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

const field = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

export function TripDetailManager({ trip, roster }: { trip: TripDetail; roster: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const refresh = () => router.refresh();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, onErr?: (e: string) => void) =>
    start(async () => { const r = await fn(); if (r.ok) refresh(); else onErr?.(r.error ?? "Errore"); });

  // Members already on the trip (to filter the roster picker).
  const usedAthleteIds = new Set(trip.members.map((m) => m.athleteId).filter(Boolean) as string[]);
  const rosterFree = roster.filter((r) => !usedAthleteIds.has(r.id));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Members */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-[var(--color-accent)]" /><h2 className="text-sm font-semibold">Partecipanti · {trip.members.length}</h2></div>
        {trip.members.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">Aggiungi i partecipanti — atleti in rosa o giocatori esterni.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {trip.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{m.name}</span>
                  {m.role === "coach" && <span className="ml-2 rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--color-muted)]">coach</span>}
                  {m.external && <span className="ml-2 rounded-full bg-[#f5a623]/15 px-1.5 py-0.5 text-[9px] uppercase text-[#f5a623]">fuori rosa</span>}
                </div>
                <button disabled={pending} onClick={() => act(() => removeTripMember(m.id))} className="rounded-md p-1 text-[var(--color-muted)] hover:text-[#ef5f6b]"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <AddMember tripId={trip.id} rosterFree={rosterFree} pending={pending} act={act} />
      </div>

      {/* Split balances */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><Scale className="h-4 w-4 text-[var(--color-accent)]" /><h2 className="text-sm font-semibold">Divisione spese</h2></div>
          <div className="text-right">
            <div className="num text-lg font-bold">{money(trip.total, trip.currency)}</div>
            <div className="text-[10px] text-[var(--color-muted)]">{money(trip.perHead, trip.currency)} a testa</div>
          </div>
        </div>
        {trip.members.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">Aggiungi partecipanti per calcolare la quota.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {trip.balances.map((b) => {
              const owed = b.balance > 0, owes = b.balance < 0;
              const color = owed ? "#3ecf8e" : owes ? "#ef5f6b" : "var(--color-muted)";
              return (
                <div key={b.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{b.name}</span>
                  <div className="text-right">
                    <span className="num font-semibold" style={{ color }}>{owed ? "+" : ""}{money(b.balance, trip.currency)}</span>
                    <div className="text-[10px] text-[var(--color-muted)]">ha pagato {money(b.paid, trip.currency)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[10px] text-[var(--color-muted)]">Verde = a credito (gli devono dei soldi) · Rosso = deve versare la sua quota.</p>
      </div>

      {/* Expenses */}
      <div className="card p-5 lg:col-span-2">
        <div className="mb-3 flex items-center gap-2"><Receipt className="h-4 w-4 text-[var(--color-accent)]" /><h2 className="text-sm font-semibold">Spese · {money(trip.total, trip.currency)}</h2></div>
        {trip.expenses.length > 0 && (
          <div className="mb-4 divide-y divide-[var(--color-border)]">
            {trip.expenses.map((e) => {
              const meta = EXPENSE_CAT_META[e.category];
              return (
                <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <div><span aria-hidden>{meta.emoji}</span> <span className="font-medium">{e.label}</span>{e.paidByName && <span className="text-[var(--color-muted)]"> · pagato da {e.paidByName}</span>}</div>
                  <div className="flex items-center gap-3">
                    <span className="num font-semibold">{money(e.amount, trip.currency)}</span>
                    <button disabled={pending} onClick={() => act(() => removeTripExpense(e.id))} className="rounded-md p-1 text-[var(--color-muted)] hover:text-[#ef5f6b]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <AddExpense tripId={trip.id} members={trip.members} pending={pending} act={act} />
      </div>
    </div>
  );
}

type ActFn = (fn: () => Promise<{ ok: boolean; error?: string }>, onErr?: (e: string) => void) => void;

function AddMember({ tripId, rosterFree, pending, act }: { tripId: string; rosterFree: { id: string; name: string }[]; pending: boolean; act: ActFn }) {
  const [mode, setMode] = useState<"roster" | "external">("roster");
  const [athleteId, setAthleteId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"player" | "coach">("player");
  const [err, setErr] = useState<string | null>(null);

  const add = () => {
    setErr(null);
    if (mode === "roster") {
      if (!athleteId) { setErr("Scegli un atleta."); return; }
      act(() => addTripMember({ tripId, athleteId, role }), setErr);
      setAthleteId("");
    } else {
      if (!name.trim()) { setErr("Scrivi il nome."); return; }
      act(() => addTripMember({ tripId, name, role, external: true }), setErr);
      setName("");
    }
  };

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <div className="mb-2 flex gap-1">
        {(["roster", "external"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className="rounded-md px-2.5 py-1 text-xs font-medium" style={mode === m ? { background: "var(--color-accent)", color: "#0a0c10" } : { color: "var(--color-muted)" }}>
            {m === "roster" ? "Dalla rosa" : "Esterno / altro maestro"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mode === "roster" ? (
          <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} className={`${field} max-w-[220px]`}>
            <option value="">Scegli atleta…</option>
            {rosterFree.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        ) : (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome giocatore esterno" className={`${field} max-w-[220px]`} />
        )}
        <select value={role} onChange={(e) => setRole(e.target.value as "player" | "coach")} className={`${field} max-w-[130px]`}>
          <option value="player">Giocatore</option>
          <option value="coach">Coach</option>
        </select>
        <button disabled={pending} onClick={add} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"><UserPlus className="h-3.5 w-3.5" />Aggiungi</button>
      </div>
      {err && <p className="mt-2 text-xs text-[#f87171]">{err}</p>}
    </div>
  );
}

function AddExpense({ tripId, members, pending, act }: { tripId: string; members: TripDetail["members"]; pending: boolean; act: ActFn }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("travel");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const add = () => {
    setErr(null);
    if (!label.trim() || !amount) { setErr("Descrizione e importo obbligatori."); return; }
    act(() => addTripExpense({ tripId, label, category, amount: Number(amount), paidById: paidById || null }), setErr);
    setLabel(""); setAmount(""); setPaidById("");
  };

  return (
    <div className="border-t border-[var(--color-border)] pt-4">
      <div className="grid gap-2 sm:grid-cols-5">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Voce (es. Furgone)" className={`${field} sm:col-span-2`} />
        <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={field}>
          {EXPENSE_CAT_ORDER.map((c) => <option key={c} value={c}>{EXPENSE_CAT_META[c].emoji} {EXPENSE_CAT_META[c].label}</option>)}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="€ totale" className={field} />
        <select value={paidById} onChange={(e) => setPaidById(e.target.value)} className={field}>
          <option value="">Pagato da… (facolt.)</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      {err && <p className="mt-2 text-xs text-[#f87171]">{err}</p>}
      <button disabled={pending} onClick={add} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"><Plus className="h-4 w-4" />Aggiungi spesa</button>
    </div>
  );
}
