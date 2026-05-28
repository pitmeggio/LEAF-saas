"use client";

import { useEffect, useState } from "react";

// AI Co-pilot — a persistent floating leaf in the bottom-right that pulses
// when there's something to say. Click → small drawer with coach-language
// insights about the athlete on screen. NOT a chatbot; not a chat thread.
// It's a presence, not a conversation. The insights come pre-computed from
// the server (deterministic) so this never hallucinates.

export function AiCopilotLeaf({
  athleteName,
  accent,
  insights,
}: {
  athleteName: string;
  accent: string;
  insights: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);

  // Stop pulsing once user has opened it at least once during this session.
  useEffect(() => {
    if (open) setPulse(false);
  }, [open]);

  return (
    <>
      {/* The leaf — always present in the bottom-right corner */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open LEAF co-pilot insights"
        className="group fixed bottom-6 right-6 z-[80] flex h-14 w-14 items-center justify-center rounded-full backdrop-blur transition-transform hover:scale-110"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${accent}55, ${accent}15 60%, transparent 75%)`,
          border: `1px solid ${accent}55`,
          boxShadow: pulse ? `0 0 0 0 ${accent}66` : `0 12px 40px ${accent}22`,
          animation: pulse ? "leaf-pulse 2.4s ease-in-out infinite" : "none",
        }}
      >
        <LeafGlyph accent={accent} />
      </button>

      {/* Drawer — slides up from above the leaf */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[81] w-[360px] max-w-[calc(100vw-3rem)] rounded-3xl border border-[var(--color-border)] bg-[#0a0c10]/96 p-5 backdrop-blur-xl"
          style={{ boxShadow: `0 30px 100px ${accent}22, 0 0 0 1px ${accent}22 inset` }}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: accent }}>
                LEAF Co-pilot
              </div>
              <div className="mt-0.5 text-sm font-semibold">Su {athleteName}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {insights.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                Nessun insight ancora. Quando arriveranno risultati o nuovi tornei in piano, te lo dico.
              </p>
            ) : (
              insights.map((line, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/40 p-3 text-sm leading-snug text-[var(--color-fg)]/90"
                  style={{ borderLeft: `2px solid ${accent}` }}
                >
                  {line}
                </div>
              ))
            )}
          </div>
          <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            Deterministico · niente hallucination · audit-safe
          </div>
        </div>
      )}

      {/* Keyframes for the pulse */}
      <style>{`
        @keyframes leaf-pulse {
          0%   { box-shadow: 0 0 0 0 ${accent}55; }
          70%  { box-shadow: 0 0 0 18px ${accent}00; }
          100% { box-shadow: 0 0 0 0 ${accent}00; }
        }
      `}</style>
    </>
  );
}

function LeafGlyph({ accent }: { accent: string }) {
  // Stylised leaf — same family as the LEAF brand mark, simplified for chip size.
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="leafCopilot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor="#0a0c10" />
        </linearGradient>
      </defs>
      <path
        d="M16 3 C 7 7, 4 14, 5 22 C 5.6 27, 9 30, 14 30 C 23 30, 28 21, 28 13 C 28 8, 22 4, 16 3 Z"
        stroke="url(#leafCopilot)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <line x1="16" y1="6" x2="16" y2="28" stroke={accent} strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
