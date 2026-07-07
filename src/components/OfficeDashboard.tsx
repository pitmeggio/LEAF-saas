import Link from "next/link";
import { Users, FileText, Wallet, Mail, Megaphone, ArrowRight, AlertTriangle, UserCog, BellRing } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { getActiveAthletes, getDocumentsData } from "@/lib/ops";
import { getInboxStats } from "@/lib/chat";
import { getSession } from "@/lib/auth";
import { getAcademy } from "@/lib/queries";
import { getSportModuleForAcademy } from "@/lib/sports/registry";
import { getExpiryAlerts } from "@/lib/anagrafica/expiry";
import { DOC_TYPE_META, EXPIRY_COLOR } from "@/lib/anagrafica/anagraficaTypes";
import { fmtDate } from "@/lib/domain";

// SEGRETERIA / OFFICE dashboard — the back-office landing. No performance or
// planning: just the three things the front desk owns (anagrafica, documenti,
// pagamenti) plus internal comms. Live counts + a "documenti da sistemare"
// worklist so the segreteria opens LEAF and immediately sees what's pending.
export async function OfficeDashboard() {
  const s = await getSession();
  const academy = await getAcademy();
  const sport = getSportModuleForAcademy(academy);
  const athletesHref = sport.key === "tennis" || sport.key === "padel" ? "/dashboard/canvas" : "/dashboard/athletes";
  const payHref = sport.key === "tennis" || sport.key === "padel" ? "/dashboard/payments-essential" : "/dashboard/finance";

  const [athletes, docData, inbox, expiryAlerts] = await Promise.all([
    getActiveAthletes(null),
    getDocumentsData(null),
    getInboxStats(),
    s?.academyId ? getExpiryAlerts(s.academyId) : Promise.resolve([]),
  ]);
  const missing = docData.missing.length;
  const expired = docData.expired.length;
  const toFix = [...docData.expired, ...docData.missing].slice(0, 6);
  const expiringSoon = expiryAlerts.filter((a) => a.status === "expiring").length;

  const areas = [
    { href: athletesHref, label: "Anagrafica", desc: "Atleti, maestri, gruppi", icon: Users },
    { href: "/dashboard/documents", label: "Documenti", desc: "Tessere, certificati, allegati", icon: FileText },
    { href: payHref, label: "Pagamenti", desc: "Incassi e quote", icon: Wallet },
    { href: "/dashboard/board", label: "Comunicazioni", desc: "Bacheca e messaggi", icon: Megaphone },
  ];

  return (
    <>
      <PageHeader title={`Ciao ${s?.name?.split(" ")[0] ?? ""}`.trim()} subtitle="Segreteria — anagrafica, documenti e pagamenti dell'academy." />
      <div className="space-y-6 p-8">
        {/* Live counts */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Atleti attivi" value={String(athletes.length)} icon={Users} href={athletesHref} />
          <StatCard label="Documenti mancanti" value={String(missing)} icon={FileText} href="/dashboard/documents" danger={missing > 0} />
          <StatCard label="Scadenze tessere/doc." value={String(expiryAlerts.length)} hint={expiringSoon > 0 ? `${expiringSoon} in arrivo` : undefined} icon={BellRing} href="/dashboard/documents" danger={expiryAlerts.some((a) => a.status === "expired")} accent={!expiryAlerts.some((a) => a.status === "expired") && expiringSoon > 0} />
          <StatCard label="Messaggi da leggere" value={String(inbox.unreadTotal)} icon={Mail} href="/dashboard/inbox" accent={inbox.unreadTotal > 0} />
        </div>

        {/* Quick access to the office areas */}
        <div>
          <div className="kicker mb-3">Aree di lavoro</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((a) => (
              <Link key={a.href} href={a.href} className="card card-hover group flex flex-col gap-2 p-5">
                <a.icon className="h-5 w-5 text-[var(--color-accent)]" />
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-semibold">{a.label}</span>
                  <ArrowRight className="h-4 w-4 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <span className="text-xs text-[var(--color-muted)]">{a.desc}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Scadenze tessere / documenti — the FIT/iPin alert */}
        {expiryAlerts.length > 0 && (
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-semibold">Scadenze tessere &amp; documenti</h2>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {expiryAlerts.slice(0, 8).map((a, i) => {
                const meta = DOC_TYPE_META[a.kind];
                const color = EXPIRY_COLOR[a.status];
                return (
                  <Link key={`${a.athleteId}-${a.kind}-${i}`} href={athletesHref} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:opacity-80">
                    <div className="min-w-0">
                      <span aria-hidden>{meta.emoji}</span>{" "}
                      <span className="font-medium">{a.athleteName}</span>
                      <span className="text-[var(--color-muted)]"> · {a.label}</span>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}22`, color }}>
                      {a.status === "expired" ? `Scaduta · ${fmtDate(a.expiresAt)}` : `Scade tra ${a.daysLeft}g · ${fmtDate(a.expiresAt)}`}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Documents to fix — the front-desk worklist */}
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />
            <h2 className="text-sm font-semibold">Documenti da sistemare</h2>
          </div>
          {toFix.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Tutto in regola — nessun documento mancante o scaduto. 🎉</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {toFix.map((d) => {
                const ath = d.enrollment?.athlete;
                const name = ath ? `${ath.firstName} ${ath.lastName}`.trim() : "—";
                const isExpired = d.status === "expired" || (d.expiresAt && new Date(d.expiresAt).getTime() < Date.now());
                return (
                  <Link key={d.id} href="/dashboard/documents" className="flex items-center justify-between gap-3 py-2.5 text-sm hover:opacity-80">
                    <div className="min-w-0">
                      <span className="font-medium">{name}</span>
                      <span className="text-[var(--color-muted)]"> · {d.name || d.type}</span>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={isExpired ? { background: "#f59e0b22", color: "#f59e0b" } : { background: "#f8717122", color: "#f87171" }}>
                      {isExpired ? `Scaduto${d.expiresAt ? ` · ${fmtDate(d.expiresAt)}` : ""}` : "Mancante"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <UserCog className="h-3.5 w-3.5" /> Profilo Segreteria — accesso a anagrafica, documenti, pagamenti e comunicazioni.
        </div>
      </div>
    </>
  );
}
