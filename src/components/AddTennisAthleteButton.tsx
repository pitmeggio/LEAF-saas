"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { UserPlus, Download, X } from "lucide-react";
import { createTennisAthletes } from "@/app/tennis-athlete-actions";

export function AddTennisAthleteButton({ accent = "#a78bfa", importMode = false }: { accent?: string; importMode?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"one" | "bulk">("one");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [yob, setYob] = useState("");
  const [gender, setGender] = useState("");
  const [hand, setHand] = useState("");
  const [bulk, setBulk] = useState("");
  const [source, setSource] = useState<"ITF" | "ATP" | "FIT">("ITF");
  const [code, setCode] = useState("");

  const submit = () =>
    start(async () => {
      setErr(null);
      const r = await createTennisAthletes(
        tab === "bulk"
          ? { bulk }
          : {
              firstName, lastName: lastName || null, yob: yob ? Number(yob) : null,
              gender: (gender || null) as "M" | "F" | null, dominantHand: (hand || null) as "right" | "left" | null,
              source: importMode ? source : null, code: importMode ? (code || null) : null,
            },
      );
      if (r.ok) { setOpen(false); setFirstName(""); setLastName(""); setYob(""); setBulk(""); setCode(""); router.refresh(); }
      else setErr(r.error);
    });

  return (
    <>
      <button onClick={() => { setOpen(true); setErr(null); }}
        className={importMode
          ? "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface)]"
          : "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#0a0c10]"}
        style={importMode ? undefined : { background: accent }}>
        {importMode ? <Download className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{importMode ? "Importa da ITF / ATP" : "Aggiungi atleti"}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="card mt-16 w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{importMode ? "Importa atleta da codice" : "Aggiungi atleti"}</h3>
              <button onClick={() => setOpen(false)} className="text-[var(--color-muted)]"><X className="h-4 w-4" /></button>
            </div>

            <div className="mb-3 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1 text-xs">
              {(["one", "bulk"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className="flex-1 rounded-md px-2 py-1.5 font-medium" style={tab === t ? { background: accent, color: "#0a0c10" } : { color: "var(--color-muted)" }}>
                  {t === "one" ? "Uno alla volta" : "Incolla più nomi"}
                </button>
              ))}
            </div>

            {tab === "one" ? (
              <div className="space-y-3">
                {importMode && (
                  <div className="grid grid-cols-2 gap-3">
                    <L label="Federazione">
                      <select className={inp} value={source} onChange={(e) => setSource(e.target.value as "ITF" | "ATP" | "FIT")}>
                        <option value="ITF">ITF Junior</option>
                        <option value="ATP">ATP / WTA</option>
                        <option value="FIT">FIT (tessera)</option>
                      </select>
                    </L>
                    <L label="Codice atleta"><input className={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="es. 1234567" /></L>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <L label="Nome"><input className={inp} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Tommaso" /></L>
                  <L label="Cognome"><input className={inp} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Rossi" /></L>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <L label="Anno nascita"><input className={inp} value={yob} onChange={(e) => setYob(e.target.value)} placeholder="2009" inputMode="numeric" /></L>
                  <L label="Sesso"><select className={inp} value={gender} onChange={(e) => setGender(e.target.value)}><option value="">—</option><option value="M">M</option><option value="F">F</option></select></L>
                  <L label="Mano"><select className={inp} value={hand} onChange={(e) => setHand(e.target.value)}><option value="">—</option><option value="right">Destro</option><option value="left">Sinistro</option></select></L>
                </div>
              </div>
            ) : (
              <L label="Un nome per riga">
                <textarea className={`${inp} w-full resize-none`} rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Tommaso Rossi\nGiulia Bianchi\nMarco Verdi"} />
              </L>
            )}

            {err && <p className="mt-3 text-xs text-[#f87171]">{err}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">Annulla</button>
              <button disabled={pending} onClick={submit} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#0a0c10] disabled:opacity-50" style={{ background: accent }}>
                {pending ? "Aggiungo…" : "Aggiungi"}
              </button>
            </div>
          </div>
        </div>, document.body)}
    </>
  );
}

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{label}</span>{children}</label>;
}
