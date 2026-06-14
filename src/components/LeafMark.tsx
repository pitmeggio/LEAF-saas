// The LEAF circuit-leaf symbol — leaf outline + central stem + branching veins
// ending in nodes. Reusable across the app (nav, login, sidebar, hero).
const BRANCHES: [number, number, number][] = [
  [352, 206, 318],
  [320, 306, 286],
  [286, 188, 250],
  [252, 324, 220],
  [220, 208, 186],
  [190, 300, 158],
];

// Single, stable gradient id shared by every LeafMark instance. A per-render
// counter (gradSeq++) produced DIFFERENT ids on server vs client (the module
// counter is at a different value during SSR than on a fresh client load),
// which tripped a React hydration mismatch that broke hydration of page-level
// client components (the upload/new-message buttons went dead). The gradient
// definition is identical everywhere, so a constant id is safe: duplicate
// <defs> are scoped per-<svg> and `url(#leafgrad)` resolves identically.
const GRAD_ID = "leafgrad";

export function LeafMark({
  size = 28,
  variant = "gradient",
  className,
}: {
  size?: number; // height in px
  variant?: "gradient" | "white" | "currentColor";
  className?: string;
}) {
  const id = GRAD_ID;
  const paint = variant === "gradient" ? `url(#${id})` : variant === "white" ? "#FFFFFF" : "currentColor";
  const width = Math.round(size * (256 / 416));
  return (
    <svg
      height={size}
      width={width}
      viewBox="130 64 256 416"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {variant === "gradient" && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#B9FF6B" />
            <stop offset="0.5" stopColor="#5CF06B" />
            <stop offset="1" stopColor="#16C47A" />
          </linearGradient>
        </defs>
      )}
      <g stroke={paint} strokeLinecap="round" strokeLinejoin="round">
        <path d="M256,72 C352,150 372,288 256,426 C140,288 160,150 256,72 Z" strokeWidth="11" />
        <line x1="256" y1="150" x2="256" y2="468" strokeWidth="12" />
        {BRANCHES.map(([my, nx, ny], i) => (
          <g key={i}>
            <line x1="256" y1={my} x2={nx} y2={ny} strokeWidth="7" />
            <circle cx={nx} cy={ny} r="9" strokeWidth="7" />
          </g>
        ))}
      </g>
    </svg>
  );
}
