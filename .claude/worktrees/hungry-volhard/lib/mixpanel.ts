const PROJECT_ID = process.env.MIXPANEL_PROJECT_ID ?? '2965141';

function basicAuth() {
  const creds = `${process.env.MIXPANEL_USERNAME}:${process.env.MIXPANEL_SECRET}`;
  return `Basic ${Buffer.from(creds).toString('base64')}`;
}

const TRACKED_EVENTS: Record<string, string> = {
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

export async function fetchMixpanelActivity(emails: string[]) {
  const results = [];

  for (const email of emails) {
    try {
      const activity = await fetchForEmail(email);
      results.push(activity);
    } catch {
      results.push({
        email,
        distinctId: null,
        events: {},
        topSearches: [],
        healthSignals: ['Mixpanel data unavailable'],
      });
    }
  }

  return results;
}

async function fetchForEmail(email: string) {
  const engageRes = await fetch(
    `https://mixpanel.com/api/2.0/engage?project_id=${PROJECT_ID}`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuth(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        filter_by_cohort: JSON.stringify({
          filter: [{ type: 'prop', selector: '$email', operator: 'equals', value: email }],
        }),
      }),
    }
  );

  const engageData = await engageRes.json();
  const profile = engageData?.results?.[0];
  let distinctId: string | null = profile?.$distinct_id ?? null;

  if (distinctId?.startsWith('$device:')) {
    distinctId = await resolveDeviceId(email) ?? distinctId;
  }

  if (!distinctId) {
    return { email, distinctId: null, events: {}, topSearches: [], healthSignals: ['No Mixpanel profile found'] };
  }

  const from = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const eventNames = Object.keys(TRACKED_EVENTS);

  const jqlQuery = `
    function main() {
      return Events({
        from_date: '${from}',
        to_date: '${to}',
        event_selectors: ${JSON.stringify(eventNames.map(e => ({ event: e })))},
      })
      .filter(e => e.distinct_id === '${distinctId}')
      .groupByUser(['name'], mixpanel.reducer.count())
    }
  `;

  const jqlRes = await fetch('https://mixpanel.com/api/2.0/jql', {
    method: 'POST',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ script: jqlQuery }),
    signal: AbortSignal.timeout(130_000),
  });

  const jqlData = await jqlRes.json();
  const events: Record<string, number> = {};
  for (const row of jqlData ?? []) {
    events[row.key?.[0]] = row.value ?? 0;
  }

  const searchQuery = `
    function main() {
      return Events({
        from_date: '${from}',
        to_date: '${to}',
        event_selectors: [{ event: 'TopSearchSubmit' }],
      })
      .filter(e => e.distinct_id === '${distinctId}')
      .groupBy(['properties.query'], mixpanel.reducer.count())
      .sort((a, b) => b.value - a.value)
      .limit(5)
    }
  `;

  const searchRes = await fetch('https://mixpanel.com/api/2.0/jql', {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ script: searchQuery }),
    signal: AbortSignal.timeout(130_000),
  });

  const searchData = await searchRes.json();
  const topSearches: string[] = (searchData ?? []).map((r: { key: string[] }) => r.key?.[0]).filter(Boolean);

  const healthSignals: string[] = [];
  const logins = events['loginSuccess'] ?? 0;
  const exportsStarted = events['exportButtonClicked'] ?? 0;
  const exportsDownloaded = events['contactsExportModalFileDownload'] ?? 0;
  const alerts = events['CreateANewAlertsButtonClicked'] ?? 0;

  if (logins === 0) healthSignals.push('No logins in 60 days (Mixpanel)');
  if (exportsStarted > 0 && exportsDownloaded === 0) healthSignals.push('Export friction: started but not downloaded');
  if (alerts === 0) healthSignals.push('No alerts set up');

  return { email, distinctId, events, topSearches, healthSignals };
}

async function resolveDeviceId(email: string): Promise<string | null> {
  try {
    const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `https://data.mixpanel.com/api/2.0/export?project_id=${PROJECT_ID}&from_date=${from}&to_date=${to}&event=loginSuccess&where=properties["email"]%3D%3D"${encodeURIComponent(email)}"&limit=1`,
      { headers: { Authorization: basicAuth() } }
    );
    const text = await res.text();
    const line = text.trim().split('\n')[0];
    if (!line) return null;
    const event = JSON.parse(line);
    return event?.properties?.distinct_id ?? null;
  } catch {
    return null;
  }
}

export function computeHealthTier(contacts: { lastLoginDate: string | null }[]): 'Active' | 'Drifting' | 'At Risk' {
  const now = Date.now();
  const days = (d: string | null) => {
    if (!d) return Infinity;
    return (now - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
  };

  if (contacts.some(c => days(c.lastLoginDate) <= 30)) return 'Active';
  if (contacts.every(c => days(c.lastLoginDate) <= 60)) return 'Drifting';
  return 'At Risk';
}
