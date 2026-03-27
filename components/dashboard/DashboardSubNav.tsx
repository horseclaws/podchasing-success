// components/dashboard/DashboardSubNav.tsx
type Tab = 'overview' | 'renewals' | 'outreach' | 'seats';

const LABELS: Record<Tab, string> = {
  overview: 'Overview', renewals: 'Renewals', outreach: 'Outreach', seats: 'Seats',
};

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function DashboardSubNav({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 border-b border-violet-100 mb-6">
      {(Object.keys(LABELS) as Tab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            active === tab
              ? 'border-brand-purple text-brand-purple'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
