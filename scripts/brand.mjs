import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public/brand";
mkdirSync(OUT, { recursive: true });

const WHITE = "#FFFFFF";
const BLACK = "#0A0C10";
const GREEN_SOLID = "#7CFF6B";

// Green gradient (lime top → emerald bottom), like the reference.
const GRAD = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#B9FF6B"/><stop offset="0.5" stop-color="#5CF06B"/><stop offset="1" stop-color="#16C47A"/>
</linearGradient></defs>`;

// ── Circuit-leaf mark (leaf outline + midrib + branching veins ending in nodes)
function leaf(paint) {
  // Branches OFF the central stem, staggered left/right (organic circuit tree).
  // [midribY, nodeX, nodeY]; nodeY < midribY so each twig rises outward to its node.
  const branches = [
    [352, 206, 318], // left low
    [320, 306, 286], // right low
    [286, 188, 250], // left mid
    [252, 324, 220], // right mid
    [220, 208, 186], // left high
    [190, 300, 158], // right high
  ];
  let veins = "";
  for (const [my, nx, ny] of branches) {
    veins += `<line x1="256" y1="${my}" x2="${nx}" y2="${ny}" stroke="${paint}" stroke-width="7" stroke-linecap="round"/>`;
    veins += `<circle cx="${nx}" cy="${ny}" r="9" fill="none" stroke="${paint}" stroke-width="7"/>`;
  }
  return `
    <g fill="none" stroke="${paint}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M256,72 C352,150 372,288 256,426 C140,288 160,150 256,72 Z" stroke-width="11"/>
      <line x1="256" y1="150" x2="256" y2="468" stroke-width="12"/>
      ${veins}
    </g>`;
}

// ── Wordmark "LEAF" — refined geometric, A as a peak (Λ, no crossbar) ─────────
const W = 34, Y0 = 60, H = 240, B = Y0 + H; // 60..300
const L = (x, c) => `<rect x="${x}" y="${Y0}" width="${W}" height="${H}" fill="${c}"/><rect x="${x}" y="${B - W}" width="140" height="${W}" fill="${c}"/>`;
const E = (x, c) => `<rect x="${x}" y="${Y0}" width="${W}" height="${H}" fill="${c}"/><rect x="${x}" y="${Y0}" width="140" height="${W}" fill="${c}"/><rect x="${x}" y="150" width="120" height="${W}" fill="${c}"/><rect x="${x}" y="${B - W}" width="140" height="${W}" fill="${c}"/>`;
const A = (x, c) => `<polygon points="${x},${B} ${x + W},${B} ${x + 112},${Y0} ${x + 78},${Y0}" fill="${c}"/><polygon points="${x + 146},${B} ${x + 180},${B} ${x + 112},${Y0} ${x + 78},${Y0}" fill="${c}"/>`;
const F = (x, c) => `<rect x="${x}" y="${Y0}" width="${W}" height="${H}" fill="${c}"/><rect x="${x}" y="${Y0}" width="140" height="${W}" fill="${c}"/><rect x="${x}" y="150" width="120" height="${W}" fill="${c}"/>`;
const word = (c) => `${L(0, c)}${E(186, c)}${A(372, c)}${F(598, c)}`; // ends ~738

const svg = (inner, defs = "", vb = "0 0 512 512", w = 1024, h = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${defs}${inner}</svg>`;

// App icon: rounded dark square + gradient mark
const appicon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${GRAD}<rect x="16" y="16" width="480" height="480" rx="112" fill="#0E1014"/>
  <g transform="translate(76,66) scale(0.7)">${leaf("url(#g)")}</g></svg>`;

// Lockup: mark + LEAF wordmark
const lockup = (markPaint, textC, defs) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1480" height="400" viewBox="0 0 1480 400">${defs}
     <g transform="translate(40,32) scale(0.74)">${leaf(markPaint)}</g>
     <g transform="translate(560,80)">${word(textC)}</g>
   </svg>`;

const jobs = [
  ["leaf-mark-gradient.png", svg(leaf("url(#g)"), GRAD)],
  ["leaf-mark-white.png", svg(leaf(WHITE))],
  ["leaf-mark-black.png", svg(leaf(BLACK))],
  ["leaf-mark-green.png", svg(leaf(GREEN_SOLID))],
  ["wordmark-white.png", svg(word(WHITE), "", "-15 45 770 270", 1540, 540)],
  ["leaf-lockup-gradient-dark.png", lockup("url(#g)", WHITE, GRAD)],
  ["leaf-lockup-white.png", lockup(WHITE, WHITE, "")],
  ["leaf-lockup-black.png", lockup(BLACK, BLACK, "")],
  ["leaf-appicon.png", appicon],
];

for (const [name, markup] of jobs) {
  await sharp(Buffer.from(markup)).png().toFile(`${OUT}/${name}`);
  console.log("wrote", name);
}
console.log("done");
