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
      {/* All pill */}
      <button
        onClick={() => onSelect(null)}
        className="text-xs font-semibold px-4 py-2 rounded-xl transition-all"
        style={{
          backgroundColor: activeOwner === null ? '#4A027D' : '#F3F0F8',
          color: activeOwner === null ? '#ffffff' : '#4A027D',
          border: `1.5px solid ${activeOwner === null ? '#4A027D' : '#e5e7eb'}`,
        }}
      >
        All
      </button>

      {OWNERS.map(({ id, label }) => {
        const isActive = activeOwner === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(isActive ? null : id)}
            className="text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            style={{
              backgroundColor: isActive ? '#4A027D' : '#F3F0F8',
              color: isActive ? '#ffffff' : '#4A027D',
              border: `1.5px solid ${isActive ? '#4A027D' : '#e5e7eb'}`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
