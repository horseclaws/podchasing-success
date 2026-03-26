'use client';

const OWNERS = [
  { id: '1774818015', label: 'Jon' },
  { id: '184892201',  label: 'Jules' },
  { id: '157100429',  label: 'Sydney' },
];

interface Props {
  activeOwner: string | null;
  onSelect: (ownerId: string | null) => void;
}

export default function OwnerFilter({ activeOwner, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => onSelect(null)}
        className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${
          activeOwner === null
            ? 'bg-brand-purple text-white border-brand-purple'
            : 'bg-violet-50 text-brand-purple border-gray-200'
        }`}
      >
        All
      </button>
      {OWNERS.map(({ id, label }) => {
        const isActive = activeOwner === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(isActive ? null : id)}
            className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${
              isActive
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'bg-violet-50 text-brand-purple border-gray-200'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
