import type { EscrowDetails } from '../types';

interface StatsBarProps {
  escrows: EscrowDetails[];
}

export function StatsBar({ escrows }: StatsBarProps) {
  const stats = {
    total: escrows.length,
    active: escrows.filter((e) => !['Released'].includes(e.state)).length,
    disputed: escrows.filter((e) => e.state === 'Disputed').length,
    completed: escrows.filter((e) => e.state === 'Released').length,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Escrows', value: stats.total, color: 'text-gray-900' },
        { label: 'Active', value: stats.active, color: 'text-blue-600' },
        { label: 'Disputed', value: stats.disputed, color: 'text-red-600' },
        { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
      ].map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">{s.label}</p>
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
