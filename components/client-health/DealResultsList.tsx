import type { DealResult } from '@/lib/deal-scoring';
import DealResultCard from './DealResultCard';

interface Props {
  deals: DealResult[];
  onSelect: (deal: DealResult) => void;
}

export default function DealResultsList({ deals, onSelect }: Props) {
  const visible = deals.slice(0, 50);
  return (
    <div className="space-y-2">
      {visible.map(deal => (
        <DealResultCard key={deal.id} deal={deal} onSelect={() => onSelect(deal)} />
      ))}
    </div>
  );
}
