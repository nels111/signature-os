import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontFamily: "-apple-system, sans-serif",
      padding: 40,
    }}>
      <div style={{ fontSize: 64, marginBottom: 16, color: "var(--brand-blue)" }}>404</div>
      <h2 style={{ color: "var(--text-primary)", marginBottom: 8 }}>Page not found</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24, maxWidth: 400, textAlign: "center" }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          padding: "12px 32px",
          background: "var(--brand-blue)",
          color: "white",
          textDecoration: "none",
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
