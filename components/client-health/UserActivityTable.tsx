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
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A027D' }}>User Activity <span style={{ color: '#9ca3af', textTransform: 'none', letterSpacing: 'normal' }}>(60 days)</span></h3>
      <div className="space-y-3">
        {contacts.map(c => {
          const mp = byEmail[c.email];
          return (
            <div key={c.email} className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 12px rgba(74,2,125,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>{c.name}</span>
                <span className="text-xs" style={{ color: '#9ca3af' }}>Last login: {c.lastLoginDate ?? 'never'}</span>
              </div>
              {mp ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                    {Object.entries(EVENT_LABELS).map(([key, label]) => (
                      <div key={key} className="text-center rounded-xl py-2 px-1" style={{ backgroundColor: '#F9F7FC' }}>
                        <div className="text-base font-semibold" style={{ color: '#4A027D' }}>{mp.events[key] ?? 0}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {mp.topSearches.length > 0 && (
                    <p className="text-xs" style={{ color: '#6b7280' }}>Top searches: {mp.topSearches.join(', ')}</p>
                  )}
                  {mp.healthSignals.map(s => (
                    <p key={s} className="text-xs mt-1 font-medium" style={{ color: '#d97706' }}>⚠ {s}</p>
                  ))}
                </>
              ) : (
                <p className="text-xs" style={{ color: '#9ca3af' }}>Mixpanel data unavailable</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
