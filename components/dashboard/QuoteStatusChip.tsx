// components/dashboard/QuoteStatusChip.tsx
type QuoteStatus = 'none' | 'draft' | 'sent' | 'accepted';

const COLORS: Record<QuoteStatus, string> = {
  none: 'bg-gray-100 text-gray-500',
  draft: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
};

const LABELS: Record<QuoteStatus, string> = {
  none: 'No Quote', draft: 'Draft', sent: 'Sent', accepted: 'Accepted',
};

export default function QuoteStatusChip({ status }: { status: QuoteStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${COLORS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
