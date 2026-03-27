// components/dashboard/RenewalDealCard.tsx
import type { DealWithQuote, DashboardContact, DashboardDeal } from '@/lib/dashboard';
import ContactChip from './ContactChip';
import QuoteStatusChip from './QuoteStatusChip';

interface Props {
  deal: DealWithQuote;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

export default function RenewalDealCard({ deal, onContactClick }: Props) {
  const renewalDate = deal.contractEndDate
    ? new Date(deal.contractEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const quoteStatus = deal.quote ? deal.quote.status : 'none';
  const dealSnap = { id: deal.id, name: deal.name, stage: deal.stage, amount: deal.amount, contractEndDate: deal.contractEndDate };

  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{deal.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{deal.stage}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">{renewalDate}</p>
          <p className="text-xs text-gray-400">{deal.daysUntilRenewal}d remaining</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {deal.amount != null && (
          <span className="text-xs text-gray-600">${deal.amount.toLocaleString()}</span>
        )}
        <QuoteStatusChip status={quoteStatus} />
        {deal.quote?.amount != null && (
          <span className="text-xs text-gray-600">
            Quote: ${deal.quote.amount.toLocaleString()}
            {deal.quote.percentChange != null && (
              <span className={deal.quote.percentChange >= 0 ? 'text-emerald-600 ml-1' : 'text-red-500 ml-1'}>
                ({deal.quote.percentChange >= 0 ? '+' : ''}{deal.quote.percentChange}%)
              </span>
            )}
          </span>
        )}
      </div>

      {deal.contacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {deal.contacts.map(c => (
            <ContactChip key={c.id} contact={c} deal={dealSnap} onClick={onContactClick} />
          ))}
        </div>
      )}
    </div>
  );
}
