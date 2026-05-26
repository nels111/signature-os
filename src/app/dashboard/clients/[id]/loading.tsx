export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="h-7 rounded w-48 mb-2" style={{ background: 'var(--border)' }} />
        <div className="h-4 rounded w-64" style={{ background: 'var(--border)' }} />
      </div>
      <div className="p-6 space-y-4">
        <div className="h-10 rounded w-full max-w-md" style={{ background: 'var(--border)' }} />
        <div className="h-64 rounded-xl" style={{ background: 'var(--border)' }} />
      </div>
    </div>
  );
}
