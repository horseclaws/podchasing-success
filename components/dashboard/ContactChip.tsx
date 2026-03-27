// components/dashboard/ContactChip.tsx
import type { DashboardContact, DashboardDeal } from '@/lib/dashboard';

const TIER_COLORS = {
  Active: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  Inactive: 'bg-amber-100 text-amber-800 ring-amber-200',
  Ghost: 'bg-red-100 text-red-800 ring-red-200',
};

interface Props {
  contact: DashboardContact;
  deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>;
  onClick: (contact: DashboardContact, deal: Props['deal']) => void;
}

export default function ContactChip({ contact, deal, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(contact, deal)}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset hover:opacity-80 transition-opacity ${TIER_COLORS[contact.tier]}`}
    >
      {contact.name || contact.email}
    </button>
  );
}
