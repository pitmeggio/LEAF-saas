"use client";

// Tiny client button that triggers the browser print dialog (Save as PDF).
// Hidden when printing so it doesn't appear on the page itself.
export function PrintButton({ className, label = "🖨 Print / Save as PDF" }: { className?: string; label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {label}
    </button>
  );
}
