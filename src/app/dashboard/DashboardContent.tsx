'use client';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

function StatCard({ label, value, change, positive }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border p-5" style={{ borderColor: '#e2e8f0' }}>
      <p className="text-sm" style={{ color: '#64748b' }}>{label}</p>
      <p className="text-2xl font-semibold mt-1" style={{ color: '#1a1a1a' }}>{value}</p>
      {change && (
        <p className={`text-xs mt-1 ${positive ? 'text-green-600' : 'text-red-500'}`}>
          {positive ? '↑' : '↓'} {change}
        </p>
      )}
    </div>
  );
}

function GrowthProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <div className="bg-white rounded-lg border p-5" style={{ borderColor: '#e2e8f0' }}>
      <div className="flex justify-between items-baseline mb-2">
        <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>Weekly Hours Target</p>
        <p className="text-sm" style={{ color: '#64748b' }}>{current} / {target} hrs</p>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: '#2c5f2d' }}
        />
      </div>
      <p className="text-xs mt-1" style={{ color: '#64748b' }}>{pct.toFixed(1)}% of target</p>
    </div>
  );
}

interface DashboardContentProps {
  role: string;
  userName: string;
}

export function DashboardContent({ role, userName }: DashboardContentProps) {
  const isSales = role === 'sales' || role === 'admin';
  const isOps = role === 'operations' || role === 'admin';

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#1a1a1a' }}>
        Welcome back, {userName.split(' ')[0]}
      </h1>

      {/* Sales View */}
      {isSales && (
        <div className="mb-8">
          <h2 className="text-sm font-medium uppercase tracking-wider mb-3" style={{ color: '#64748b' }}>
            Sales
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Leads" value="0" />
            <StatCard label="Open Deals" value="0" />
            <StatCard label="Pipeline Value" value="£0" />
            <StatCard label="Conversion Rate" value="0%" />
          </div>
        </div>
      )}

      {/* Ops View */}
      {isOps && (
        <div className="mb-8">
          <h2 className="text-sm font-medium uppercase tracking-wider mb-3" style={{ color: '#64748b' }}>
            Operations
          </h2>
          <GrowthProgressBar current={163} target={1000} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <StatCard label="Active Contracts" value="0" />
            <StatCard label="This Week Revenue" value="£0" />
            <StatCard label="Avg Audit Score" value="0" />
            <StatCard label="Compliance" value="0%" />
          </div>
        </div>
      )}
    </div>
  );
}
