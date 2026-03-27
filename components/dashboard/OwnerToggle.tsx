// components/dashboard/OwnerToggle.tsx
import { OWNER_NAMES } from '@/lib/hubspot';

interface Props {
  selected: string; // 'all' or a hubspot_owner_id
  onChange: (ownerId: string) => void;
  currentUserId: string; // Sydney's own hubspot_owner_id
}

export default function OwnerToggle({ selected, onChange, currentUserId }: Props) {
  const options = [
    { value: 'all', label: 'All' },
    { value: currentUserId, label: 'My Book' },
    ...Object.entries(OWNER_NAMES)
      .filter(([id]) => id !== currentUserId)
      .map(([id, name]) => ({ value: id, label: name.split(' ')[0] })),
  ];

  return (
    <div className="flex gap-1 mb-5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selected === opt.value
              ? 'bg-brand-purple text-white'
              : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
