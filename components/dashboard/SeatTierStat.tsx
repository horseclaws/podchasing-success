// components/dashboard/SeatTierStat.tsx
import type { LoginTier } from '@/lib/dashboard';

const COLORS: Record<LoginTier, { border: string; label: string }> = {
  Active:   { border: 'border-emerald-200 bg-emerald-50', label: 'text-emerald-700' },
  Inactive: { border: 'border-amber-200 bg-amber-50',     label: 'text-amber-700' },
  Ghost:    { border: 'border-red-200 bg-red-50',         label: 'text-red-700' },
};

interface Props {
  tier: LoginTier;
  count: number;
  onClick: (tier: LoginTier) => void;
}

export default function SeatTierStat({ tier, count, onClick }: Props) {
  const c = COLORS[tier];
  return (
    <button
      onClick={() => onClick(tier)}
      className={`rounded-2xl p-4 border text-left w-full hover:opacity-90 transition-opacity ${c.border}`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${c.label}`}>{tier}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{count}</p>
      <p className="text-xs text-gray-400 mt-0.5">seats</p>
    </button>
  );
}
