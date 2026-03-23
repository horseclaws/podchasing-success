type Tier = 'Active' | 'Drifting' | 'At Risk';

const COLORS: Record<Tier, string> = {
  Active: 'bg-green-100 text-green-800',
  Drifting: 'bg-yellow-100 text-yellow-800',
  'At Risk': 'bg-red-100 text-red-800',
};

export default function HealthTierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLORS[tier]}`}>
      {tier}
    </span>
  );
}
