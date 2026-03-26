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
      className="w-full text-left rounded-2xl p-4 transition-all"
      style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#4A027D')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#ede9f5')}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Score badge + deal name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="shrink-0 rounded-lg px-2 py-1 text-center"
            style={{ backgroundColor: '#F3F0F8', minWidth: '52px' }}
          >
            <div className="text-sm font-bold" style={{ color: '#4A027D' }}>{deal.totalScore}</div>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>score</div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#1a1a2e' }}>{deal.name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{deal.stage}</p>
          </div>
        </div>
        {/* Right-side metadata */}
        <div className="shrink-0 text-right space-y-0.5">
          <p className="text-sm font-semibold" style={{ color: '#4A027D' }}>{formatAmount(deal.amount)}</p>
          {deal.contractEndDate && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>Renews {formatDate(deal.contractEndDate)}</p>
          )}
          {deal.lastContactedDate && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>Contacted {daysSince(deal.lastContactedDate)}</p>
          )}
          {deal.ownerId && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>{ownerName(deal.ownerId)}</p>
          )}
          {deal.businessType && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>{deal.businessType}</p>
          )}
        </div>
      </div>
    </button>
  );
}
