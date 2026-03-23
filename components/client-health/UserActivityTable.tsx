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
}: { contacts: Contact[]; mixpanel: MixpanelUser[] }) {
  const byEmail = Object.fromEntries(mixpanel.map(m => [m.email, m]));

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">User Activity (60 days)</h3>
      <div className="space-y-4">
        {contacts.map(c => {
          const mp = byEmail[c.email];
          return (
            <div key={c.email} className="border border-gray-200 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{c.name}</span>
                <span className="text-xs text-gray-400">Last login: {c.lastLoginDate ?? 'never'}</span>
              </div>
              {mp ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 mb-2">
                    {Object.entries(EVENT_LABELS).map(([key, label]) => (
                      <div key={key} className="text-center">
                        <div className="text-base font-semibold text-gray-900">{mp.events[key] ?? 0}</div>
                        <div className="text-xs text-gray-400">{label}</div>
                      </div>
                    ))}
                  </div>
                  {mp.topSearches.length > 0 && (
                    <p className="text-xs text-gray-500">Top searches: {mp.topSearches.join(', ')}</p>
                  )}
                  {mp.healthSignals.map(s => (
                    <p key={s} className="text-xs text-yellow-600">⚠ {s}</p>
                  ))}
                </>
              ) : (
                <p className="text-xs text-gray-400">Mixpanel data unavailable</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
