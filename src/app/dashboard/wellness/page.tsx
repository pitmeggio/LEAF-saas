import { PageHeader } from "@/components/PageHeader";
import { requireAcademyId } from "@/lib/auth";
import { getSquadReadiness, type SquadMember } from "@/lib/wellness";
import { BAND_COLOR, BAND_LABEL, readinessBand } from "@/lib/wellnessCore";
import { Sparkles, AlertTriangle, Moon, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

// LEAF AMS — squad readiness board. The Teamworks/Smartabase flagship, one
// screen: who checked in today, how ready they are, and who needs a look.
export default async function WellnessBoardPage() {
  const academyId = await requireAcademyId();
  const squad = await getSquadReadiness(academyId);

  return (
    <>
      <PageHeader
        title="Benessere"
        subtitle="Prontezza della squadra dai check-in di oggi — sonno, dolori, energia, umore, stress."
      />
      <div className="space-y-6 p-8">
        {squad.total === 0 ? (
          <div className="card p-10 text-center text-sm text-[var(--color-muted)]">
            Nessun atleta ancora. Quando i tuoi atleti fanno il check-in dall&apos;app, la prontezza della squadra compare qui.
          </div>
        ) : (
          <>
            {/* Top signals */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Check-in oggi" value={`${squad.checkedInToday}/${squad.total}`} />
              <Stat label="Prontezza media" value={squad.avgReadiness != null ? String(squad.avgReadiness) : "—"} accent={squad.avgReadiness != null ? BAND_COLOR[readinessBand(squad.avgReadiness)] : undefined} />
              <Stat label="Da attenzionare" value={String(squad.alerts.filter((a) => a.kind !== "missing").length)} accent={squad.alerts.some((a) => a.kind === "low") ? "#f87171" : undefined} />
            </div>

            {/* AI-style alerts */}
            {squad.alerts.length > 0 && (
              <div className="card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}><Sparkles className="h-3 w-3" />AI</span>
                  <h2 className="text-sm font-semibold">Chi ha bisogno di uno sguardo</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {squad.alerts.slice(0, 8).map((a) => (
                    <div key={`${a.athleteId}-${a.kind}`} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
                      {a.kind === "low" ? <AlertTriangle className="h-4 w-4 shrink-0 text-[#f87171]" /> : a.kind === "sore" ? <Activity className="h-4 w-4 shrink-0 text-[#f59e0b]" /> : <Moon className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />}
                      <span className="font-medium">{a.name}</span>
                      <span className="text-[var(--color-muted)]">· {a.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Squad board */}
            <div>
              <div className="kicker mb-3">Squadra · {squad.total} atleti</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {squad.members.map((m) => <MemberCard key={m.athleteId} m={m} />)}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="kicker">{label}</div>
      <div className="num mt-1 text-2xl font-bold" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

function MemberCard({ m }: { m: SquadMember }) {
  const color = BAND_COLOR[m.band];
  return (
    <div className="card p-4" style={m.band === "low" && m.checkedInToday ? { borderColor: "#f8717155" } : undefined}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{m.name}</div>
          <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            {m.checkedInToday ? BAND_LABEL[m.band] : "Nessun check-in oggi"}
          </div>
        </div>
        <Ring value={m.checkedInToday ? m.readiness : null} color={m.checkedInToday ? color : "var(--color-border)"} />
      </div>

      {/* 7-day trend */}
      {m.trend.length >= 2 ? (
        <div className="mt-3 flex items-end gap-1" style={{ height: 34 }}>
          {m.trend.map((v, i) => (
            <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(8, v)}%`, background: BAND_COLOR[readinessBand(v)], opacity: i === m.trend.length - 1 ? 1 : 0.5 }} />
          ))}
        </div>
      ) : (
        <div className="mt-3 h-[34px] rounded-md border border-dashed border-[var(--color-border)]" />
      )}

      {m.checkedInToday && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
          {m.soreness != null && <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" />Dolori {m.soreness}/5</span>}
          {m.sleepHours != null && <span className="inline-flex items-center gap-1"><Moon className="h-3 w-3" />{m.sleepHours}h</span>}
        </div>
      )}
    </div>
  );
}

function Ring({ value, color }: { value: number | null; color: string }) {
  const r = 22, c = 2 * Math.PI * r;
  const off = value == null ? c : c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative h-[58px] w-[58px] shrink-0">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="num text-base font-bold" style={{ color: value == null ? "var(--color-muted)" : color }}>{value ?? "—"}</span>
      </div>
    </div>
  );
}
