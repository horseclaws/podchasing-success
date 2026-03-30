'use client';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function ClientDescriptionForm({ value, onChange, onSubmit, isLoading }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
      <label className="text-sm font-medium text-gray-700">
        Describe your client
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. A venture capital investor focused on early-stage B2B SaaS startups who advises founders on go-to-market strategy"
        rows={4}
        className="text-sm border border-gray-300 rounded px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isLoading}
      />
      <button
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        className="self-start px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Finding…' : 'Find Podcasts'}
      </button>
    </div>
  );
}
