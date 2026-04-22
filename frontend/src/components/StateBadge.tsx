import { STATE_COLORS, STATE_LABELS } from '../lib/constants';
import type { EscrowState } from '../types';

export function StateBadge({ state }: { state: EscrowState }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATE_COLORS[state] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {STATE_LABELS[state] ?? state}
    </span>
  );
}
