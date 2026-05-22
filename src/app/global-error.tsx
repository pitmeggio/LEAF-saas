"use client";

import { useEffect } from "react";

// Last-resort boundary for errors in the root layout itself. This replaces the
// whole document (and the global stylesheet), so it is intentionally styled
// inline and kept dependency-free.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c0f17",
          color: "#e7eaf0",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "1.25rem",
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#7CFF6B" }}>LEAF</div>
          <h1 style={{ marginTop: 16, fontSize: 22 }}>Something went wrong.</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#9aa3b2", maxWidth: 360 }}>
            We hit an unexpected error. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              borderRadius: 12,
              border: "none",
              background: "#7CFF6B",
              color: "#0a0c10",
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
