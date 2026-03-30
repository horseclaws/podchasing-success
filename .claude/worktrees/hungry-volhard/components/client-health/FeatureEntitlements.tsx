const LABELS: Record<string, string> = {
  brand_safety: 'Brand Safety',
  sponsor_history: 'Sponsor History',
  transcript_search: 'Transcript Search',
  tell_me_why: 'Tell Me Why',
  political_skew: 'Political Skew',
  list_making: 'List Making',
  seats: 'Seats',
  alerts: 'Alerts',
};

export default function FeatureEntitlements({ entitlements }: { entitlements: Record<string, unknown> }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Feature Entitlements (contract, not usage)</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(LABELS).map(([key, label]) => {
          const val = entitlements[key];
          const enabled = val === true || val === 'true' || (typeof val === 'number' && val > 0);
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-xs text-gray-700">{label}{typeof val === 'number' ? ` (${val})` : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
