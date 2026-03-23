export default function ChorusInsights({ data }: { data: null }) {
  if (data !== null) return null;
  return (
    <div className="border border-gray-200 rounded p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Chorus Insights</h3>
      <p className="text-xs text-gray-400">Chorus data unavailable — coming soon.</p>
    </div>
  );
}
