import PillBadge from '@/components/ui/PillBadge';

type Tier = 'Active' | 'Drifting' | 'At Risk';

const VARIANTS: Record<Tier, 'green' | 'yellow' | 'magenta'> = {
  Active:    'green',
  Drifting:  'yellow',
  'At Risk': 'magenta',
};

export default function HealthTierBadge({ tier }: { tier: Tier }) {
  return <PillBadge label={tier} variant={VARIANTS[tier]} />;
}
