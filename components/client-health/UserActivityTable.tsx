import InsightCard from '@/components/ui/InsightCard';

const EVENT_LABELS: Record<string, string> = {
  loginSuccess: 'Logins',
  episodePlayButtonClicked: 'Episodes Played',
  'tellmewhy-launch': 'Tell Me Why',
  addItemToListClicked: 'List Adds',
  exportButtonClicked: 'Exports Started',
  contactsExportModalFileDownload: 'Exports Downloaded',
  contactCopied: 'Contacts Copied',
  TopSearchSubmit: 'Searches',
  filtersApplied: 'Filters Applied',
  CreateANewAlertsButtonClicked: 'Alerts Created',
};

interface Contact { name: string; email: string; lastLoginDate: string | null }
interface MixpanelUser { email: string; events: Record<string, number>; topSearches: string[]; healthSignals: string[] }

export default function UserActivityTable({
  contacts, mixpanel,
}: { contacts: Contact[]; mixpanel?: MixpanelUser[] | null }) {
  const byEmail = mixpanel
    ? Object.fromEntries(mixpanel.map(m => [m.email, m]))
    : {};

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">
        User Activity <span className="text-gray-400 normal-case tracking-normal">(60 days)</span>
      </h3>
      <div className="space-y-3">
        {contacts.map(c => {
          const mp = byEmail[c.email];
          return (
            <InsightCard key={c.email} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">{c.name}</span>
                <span className="text-xs text-gray-400">Last login: {c.lastLoginDate ?? 'never'}</span>
              </div>
              {mp ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                    {Object.entries(EVENT_LABELS).map(([key, label]) => (
                      <div key={key} className="text-center rounded-xl py-2 px-1 bg-background">
                        <div className="text-base font-semibold text-brand-purple">{mp.events[key] ?? 0}</div>
                        <div className="text-xs mt-0.5 text-gray-400">{label}</div>
                      </div>
                    ))}
                  </div>
                  {mp.topSearches.length > 0 && (
                    <p className="text-xs text-gray-500">Top searches: {mp.topSearches.join(', ')}</p>
                  )}
                  {mp.healthSignals.map(s => (
                    <p key={s} className="text-xs mt-1 font-medium text-amber-600">⚠ {s}</p>
                  ))}
                </>
              ) : (
                <p className="text-xs text-gray-400">Mixpanel data unavailable</p>
              )}
            </InsightCard>
          );
        })}
      </div>
    </div>
  );
}
