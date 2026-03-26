'use client';

type PollType = 'renew_30' | 'renew_60' | 'contacted_45';
type Mode = 'idle' | 'search' | 'poll_renew_30' | 'poll_renew_60' | 'poll_contacted_45';

interface Props {
  activeMode: Mode;
  disabled: boolean;
  onPoll: (type: PollType) => void;
}

const BUTTONS: { type: PollType; label: string }[] = [
  { type: 'renew_30',     label: 'Renewing in 30 days' },
  { type: 'renew_60',     label: 'Renewing in 60 days' },
  { type: 'contacted_45', label: 'Last Contacted 45+ days' },
];

export default function PollButtons({ activeMode, disabled, onPoll }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {BUTTONS.map(({ type, label }) => {
        const isActive = activeMode === `poll_${type}`;
        return (
          <button
            key={type}
            onClick={() => onPoll(type)}
            disabled={disabled}
            className="text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-40"
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
