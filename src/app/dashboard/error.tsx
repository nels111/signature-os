"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 60,
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
      <h2 style={{ color: "#333", marginBottom: 8 }}>Page Error</h2>
      <p style={{ color: "#666", marginBottom: 24 }}>
        This page encountered an error. Your data is safe.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          background: "#2c5f2d",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Reload Page
      </button>
    </div>
  );
}
