"use client";

// Excel import for the line schedule (Trysil's Treningsskjema layout).
// V1 is a placeholder button — the parser ships in the next iteration so
// the demo path can rely on manual cell-clicks. The button stays here so
// the surface communicates the intent (and so we can flip it on tomorrow).
export function LineImportButton() {
  return (
    <button
      type="button"
      disabled
      title="Coming soon — drop your Treningsskjema.xlsx straight onto the grid"
      className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-muted)] cursor-not-allowed"
    >
      📂 Import Excel · coming
    </button>
  );
}
