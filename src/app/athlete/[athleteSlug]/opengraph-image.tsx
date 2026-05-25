import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { sportConfig } from "@/lib/sport";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Athlete profile on LEAF";

// Branded social-share card for a shared athlete profile link.
export default async function Image({ params }: { params: Promise<{ athleteSlug: string }> }) {
  const { athleteSlug } = await params;
  const a = await prisma.athlete.findUnique({
    where: { publicSlug: athleteSlug },
    select: {
      firstName: true, lastName: true, sport: true, fisPoints: true, worldRank: true,
      photoColor: true, publicVerified: true, publicProfileEnabled: true, publicVisibility: true, publicShowRanking: true,
      // Platform-level gate — same condition the page itself uses to render
      // (or 404). The OG card collapses to a generic "LEAF" mark when the
      // feature isn't enabled for any of the athlete's academies, so a stale
      // shared URL doesn't keep teasing a profile that isn't actually live.
      enrollments: { select: { academy: { select: { featurePublicProfiles: true } } } },
    },
  });

  const featureOn = !!a && a.enrollments.some((e) => e.academy?.featurePublicProfiles);
  const visible = a && featureOn && a.publicProfileEnabled && a.publicVisibility === "PUBLIC";
  const cfg = sportConfig(a?.sport);
  const name = visible ? `${a!.firstName} ${a!.lastName}` : "LEAF";
  const accent = "#7CFF6B";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg,#0c0f17 0%,#0b0e15 100%)", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#fff" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: accent }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>LEAF</div>
          <div style={{ fontSize: 22, color: "#9aa4b6", marginLeft: 8 }}>· verified athlete profile</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ fontSize: 76, fontWeight: 800, color: "#fff", letterSpacing: -2, lineHeight: 1 }}>{name}</div>
            {visible && a!.publicVerified && (
              <div style={{ display: "flex", fontSize: 24, color: accent, background: "rgba(124,255,107,0.12)", padding: "8px 16px", borderRadius: 999 }}>✓ Verified</div>
            )}
          </div>
          {visible && (
            <div style={{ display: "flex", gap: 48, color: "#fff", fontSize: 30 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 18, color: "#9aa4b6", textTransform: "uppercase", letterSpacing: 2 }}>{cfg.pointsLabel}</span>
                <span style={{ fontWeight: 700, color: accent }}>{a!.publicShowRanking && a!.fisPoints != null ? a!.fisPoints : "—"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 18, color: "#9aa4b6", textTransform: "uppercase", letterSpacing: 2 }}>{cfg.rankLabel}</span>
                <span style={{ fontWeight: 700 }}>{a!.publicShowRanking && a!.worldRank != null ? `#${a!.worldRank}` : "—"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 18, color: "#9aa4b6", textTransform: "uppercase", letterSpacing: 2 }}>Sport</span>
                <span style={{ fontWeight: 700 }}>{cfg.label}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ fontSize: 24, color: "#9aa4b6" }}>The performance intelligence layer for elite sport</div>
      </div>
    ),
    size,
  );
}
