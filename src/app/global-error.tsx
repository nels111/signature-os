"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "-apple-system, sans-serif",
          padding: 40,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
          <h2 style={{ color: "#333", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: "#666", marginBottom: 24, maxWidth: 400, textAlign: "center" }}>
            An unexpected error occurred. Please try again or contact Nelson.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 32px",
              background: "#2056A4",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
