type Tier = 'Active' | 'Drifting' | 'At Risk';

const STYLES: Record<Tier, { bg: string; color: string }> = {
  Active:    { bg: 'rgba(43,218,159,0.15)',  color: '#0d9f72' },
  Drifting:  { bg: 'rgba(255,239,112,0.35)', color: '#92640a' },
  'At Risk': { bg: 'rgba(251,4,103,0.12)',   color: '#c4004f' },
};

export default function HealthTierBadge({ tier }: { tier: Tier }) {
  const { bg, color } = STYLES[tier];
  return (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>
      {tier}
    </span>
  );
}
