import type { DealResult } from '@/lib/deal-scoring';
import { ownerName } from '@/lib/hubspot';

interface Props {
  deal: DealResult;
  onSelect: () => void;
}

function formatAmount(amount: number | null): string {
  if (amount === null) return '—';
  return '$' + Math.round(amount).toLocaleString('en-US');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(iso: string | null): string {
  if (!iso) return '—';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return `${days}d ago`;
}

export default function DealResultCard({ deal, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-2xl p-4 bg-white border border-violet-100 transition-colors hover:border-brand-purple"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0 rounded-lg px-2 py-1 text-center bg-violet-50 min-w-[52px]">
            <div className="text-sm font-bold text-brand-purple">{deal.totalScore}</div>
            <div className="text-[10px] text-gray-400">score</div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-foreground">{deal.name}</p>
            <p className="text-xs mt-0.5 text-gray-400">{deal.stage}</p>
          </div>
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          <p className="text-sm font-semibold text-brand-purple">{formatAmount(deal.amount)}</p>
          {deal.contractEndDate && (
            <p className="text-xs text-gray-400">Renews {formatDate(deal.contractEndDate)}</p>
          )}
          {deal.lastContactedDate && (
            <p className="text-xs text-gray-400">Contacted {daysSince(deal.lastContactedDate)}</p>
          )}
          {deal.ownerId && (
            <p className="text-xs text-gray-400">{ownerName(deal.ownerId)}</p>
          )}
          {deal.businessType && (
            <p className="text-xs text-gray-400">{deal.businessType}</p>
          )}
        </div>
      </div>
    </button>
  );
}
