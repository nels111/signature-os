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
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100%",
      fontFamily: "-apple-system, sans-serif",
      padding: 40,
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
      <h2 style={{ color: "var(--text-primary)", marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24, maxWidth: 400, textAlign: "center" }}>
        An unexpected error occurred. Please try again or contact Nelson.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "12px 32px",
          background: "var(--brand-blue)",
          color: "var(--surface)",
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
  );
}
