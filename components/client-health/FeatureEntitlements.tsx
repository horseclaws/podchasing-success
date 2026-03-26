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
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 12px rgba(74,2,125,0.06)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A027D' }}>Feature Entitlements</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {Object.entries(LABELS).map(([key, label]) => {
          const val = entitlements[key];
          const enabled = val === true || val === 'true' || (typeof val === 'number' && val > 0);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: enabled ? '#2BDA9F' : '#e5e7eb' }} />
              <span className="text-xs" style={{ color: enabled ? '#1a1a2e' : '#9ca3af' }}>
                {label}{typeof val === 'number' ? ` (${val})` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
