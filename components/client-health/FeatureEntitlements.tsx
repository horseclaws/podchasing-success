import InsightCard from '@/components/ui/InsightCard';

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
    <InsightCard>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">Feature Entitlements</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {Object.entries(LABELS).map(([key, label]) => {
          const val = entitlements[key];
          const enabled = val === true || val === 'true' || (typeof val === 'number' && val > 0);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${enabled ? 'bg-brand-mint' : 'bg-gray-200'}`} />
              <span className={`text-xs ${enabled ? 'text-foreground' : 'text-gray-400'}`}>
                {label}{typeof val === 'number' ? ` (${val})` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}
