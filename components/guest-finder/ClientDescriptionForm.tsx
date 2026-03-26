'use client';
import InsightCard from '@/components/ui/InsightCard';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function ClientDescriptionForm({ value, onChange, onSubmit, isLoading }: Props) {
  return (
    <InsightCard className="flex flex-col gap-3">
      <label className="text-sm font-medium text-gray-700">
        Describe your client
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. A venture capital investor focused on early-stage B2B SaaS startups who advises founders on go-to-market strategy"
        rows={4}
        className="text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple"
        disabled={isLoading}
      />
      <button
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        className="self-start px-4 py-1.5 text-sm bg-brand-purple text-white rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {isLoading ? 'Finding…' : 'Find Podcasts'}
      </button>
    </InsightCard>
  );
}
