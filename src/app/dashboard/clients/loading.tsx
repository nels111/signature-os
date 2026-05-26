export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 rounded w-40" style={{ background: 'var(--border)' }} />
      <div className="h-4 rounded w-64" style={{ background: 'var(--border)' }} />
      <div className="space-y-3 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded" style={{ background: 'var(--border)', opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </div>
  );
}
