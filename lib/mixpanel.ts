const PROJECT_ID = process.env.MIXPANEL_PROJECT_ID ?? '2965141';

function basicAuth() {
  const creds = `${process.env.MIXPANEL_USERNAME}:${process.env.MIXPANEL_SECRET}`;
  return `Basic ${Buffer.from(creds).toString('base64')}`;
}

const RELIABLE_EVENTS = [
  'loginSuccess',
  'episodePlayButtonClicked',
  'tellmewhy-launch',
  'addItemToListClicked',
  'exportButtonClicked',
  'contactsExportModalFileDownload',
  'contactCopied',
  'CreateANewAlertsButtonClicked',
];

const UNRELIABLE_EVENTS = ['TopSearchSubmit', 'filtersApplied'];

const ALL_EVENTS = [...RELIABLE_EVENTS, ...UNRELIABLE_EVENTS];

export const TRACKED_EVENTS: Record<string, string> = {
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

interface MixpanelProfile {
  distinctId: string;
  userId: string | null; // numeric user_id if resolved
  lastSeen: string | null;
}

// Step 1: Look up Mixpanel profile by email using GET /engage with where param
async function getProfile(email: string): Promise<MixpanelProfile | null> {
  const where = encodeURIComponent(`properties["$email"] == "${email}"`);
  const url = `https://mixpanel.com/api/2.0/engage?where=${where}&project_id=${PROJECT_ID}`;
  try {
    const res = await fetch(url, { headers: { Authorization: basicAuth() } });
    if (!res.ok) return null;
    const data = await res.json();
    const results: Array<Record<string, unknown>> = data?.results ?? [];
    if (!results.length) return null;

    // Prefer numeric distinct_id (= already resolved user_id), then most recent last_seen
    let best = results[0];
    for (const p of results) {
      const did = String(p.$distinct_id ?? '');
      const bestDid = String(best.$distinct_id ?? '');
      const isNumeric = /^\d+$/.test(did);
      const bestIsNumeric = /^\d+$/.test(bestDid);
      if (isNumeric && !bestIsNumeric) { best = p; continue; }
      const lastSeen = String((p as Record<string, Record<string, string>>).$properties?.['$last_seen'] ?? '');
      const bestLastSeen = String((best as Record<string, Record<string, string>>).$properties?.['$last_seen'] ?? '');
      if (lastSeen > bestLastSeen && !(bestIsNumeric && !isNumeric)) best = p;
    }

    const did = String(best.$distinct_id ?? '');
    const props = (best as Record<string, Record<string, string>>).$properties ?? {};
    const isNumeric = /^\d+$/.test(did);

    return {
      distinctId: did,
      userId: isNumeric ? did : null,
      lastSeen: props['$last_seen'] ?? null,
    };
  } catch {
    return null;
  }
}

// Step 1b: For device-based IDs, resolve numeric user_id from login events
async function resolveUserIdFromLogins(distinctId: string): Promise<string | null> {
  if (!distinctId.startsWith('$device:')) return null;
  const device = distinctId.replace('$device:', '');
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const where = encodeURIComponent(`properties["$device_id"] == "${device}"`);
  const event = encodeURIComponent(JSON.stringify(['loginSuccess']));
  const url = `https://data.mixpanel.com/api/2.0/export?from_date=${from}&to_date=${to}&project_id=${PROJECT_ID}&event=${event}&where=${where}`;
  try {
    const res = await fetch(url, { headers: { Authorization: basicAuth() }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const text = await res.text();
    const line = text.trim().split('\n')[0];
    if (!line) return null;
    const ev = JSON.parse(line);
    const uid = ev?.properties?.['$user_id'];
    return uid ? String(uid) : null;
  } catch {
    return null;
  }
}

// Step 2: Batch JQL — all users, all events, one call
async function jqlEventCounts(userIds: string[]): Promise<Record<string, Record<string, number>>> {
  if (!userIds.length) return {};
  const selectors = ALL_EVENTS.map(e => `{event: "${e}"}`).join(', ');
  const from = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const script = `
function main() {
  var users = ${JSON.stringify(userIds)};
  return Events({
    from_date: "${from}",
    to_date: "${to}",
    event_selectors: [${selectors}]
  })
  .filter(function(e) { return users.indexOf(String(e.properties.$user_id)) > -1; })
  .groupBy(["properties.$user_id", "name"], mixpanel.reducer.count());
}`;

  try {
    const res = await fetch(`https://mixpanel.com/api/2.0/jql?project_id=${PROJECT_ID}`, {
      method: 'POST',
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return {};
    const rows: Array<{ key: [string, string]; value: number }> = await res.json();
    const result: Record<string, Record<string, number>> = {};
    for (const row of rows ?? []) {
      const uid = row.key[0];
      const event = row.key[1];
      if (!result[uid]) result[uid] = {};
      result[uid][event] = row.value;
    }
    return result;
  } catch {
    return {};
  }
}

// Step 3: Batch JQL — search terms for all users, one call
async function jqlSearchTerms(userIds: string[]): Promise<Record<string, string[]>> {
  if (!userIds.length) return {};
  const from = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const script = `
function main() {
  var users = ${JSON.stringify(userIds)};
  return Events({
    from_date: "${from}",
    to_date: "${to}",
    event_selectors: [{event: "TopSearchSubmit"}]
  })
  .filter(function(e) {
    return users.indexOf(String(e.properties.$user_id)) > -1 && e.properties.search_term;
  })
  .groupBy(["properties.$user_id", "properties.search_term"], mixpanel.reducer.count());
}`;

  try {
    const res = await fetch(`https://mixpanel.com/api/2.0/jql?project_id=${PROJECT_ID}`, {
      method: 'POST',
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return {};
    const rows: Array<{ key: [string, string]; value: number }> = await res.json();
    const byUser: Record<string, Array<{ term: string; count: number }>> = {};
    for (const row of rows ?? []) {
      const uid = row.key[0];
      if (!byUser[uid]) byUser[uid] = [];
      byUser[uid].push({ term: row.key[1], count: row.value });
    }
    const result: Record<string, string[]> = {};
    for (const uid of Object.keys(byUser)) {
      result[uid] = byUser[uid].sort((a, b) => b.count - a.count).slice(0, 10).map(x => x.term);
    }
    return result;
  } catch {
    return {};
  }
}

// Fallback: JQL join with People() for users we couldn't resolve to a numeric user_id
async function jqlFallbackByEmail(emails: string[]): Promise<{
  events: Record<string, Record<string, number>>;
  searches: Record<string, string[]>;
}> {
  if (!emails.length) return { events: {}, searches: {} };
  const emailConditions = emails.map(e => `email == "${e}"`).join(' || ');
  const selectors = ALL_EVENTS.map(e => `{event: "${e}"}`).join(', ');
  const from = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const script = `
function main() {
  return join(
    Events({
      from_date: "${from}",
      to_date: "${to}",
      event_selectors: [${selectors}]
    }),
    People()
  )
  .filter(function(tuple) {
    var email = tuple.user && tuple.user.properties.$email;
    return email && (${emailConditions});
  })
  .groupBy(["user.properties.$email", "event.name"], mixpanel.reducer.count());
}`;

  try {
    const res = await fetch(`https://mixpanel.com/api/2.0/jql?project_id=${PROJECT_ID}`, {
      method: 'POST',
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return { events: {}, searches: {} };
    const rows: Array<{ key: [string, string]; value: number }> = await res.json();
    const events: Record<string, Record<string, number>> = {};
    for (const row of rows ?? []) {
      const email = row.key[0];
      if (!events[email]) events[email] = {};
      events[email][row.key[1]] = row.value;
    }
    return { events, searches: {} };
  } catch {
    return { events: {}, searches: {} };
  }
}

export interface MixpanelUserActivity {
  email: string;
  events: Record<string, number>;
  topSearches: string[];
  healthSignals: string[];
}

export async function fetchMixpanelActivity(
  emails: string[],
  hubspotContacts?: Array<{ email: string; lastLoginDate: string | null }>
): Promise<MixpanelUserActivity[]> {
  // Step 1: Look up profiles
  const profiles: Record<string, MixpanelProfile | null> = {};
  for (const email of emails) {
    profiles[email] = await getProfile(email);
  }

  // Step 1b: Resolve device-based IDs
  const needsResolution = emails.filter(e => profiles[e]?.distinctId.startsWith('$device:'));
  for (const email of needsResolution) {
    const did = profiles[email]!.distinctId;
    const uid = await resolveUserIdFromLogins(did);
    if (uid) profiles[email]!.userId = uid;
  }

  // Build user_id → email map
  const userIdToEmail: Record<string, string> = {};
  for (const email of emails) {
    const uid = profiles[email]?.userId;
    if (uid) userIdToEmail[uid] = email;
  }

  const allUserIds = Object.keys(userIdToEmail);
  const unresolvedEmails = emails.filter(e => profiles[e] && !profiles[e]!.userId);

  // Step 2 & 3: Batch JQL (resolved users)
  const [eventData, searchData] = await Promise.all([
    jqlEventCounts(allUserIds),
    jqlSearchTerms(allUserIds),
  ]);

  // Step 4: Fallback for unresolved users
  const fallback = unresolvedEmails.length
    ? await jqlFallbackByEmail(unresolvedEmails)
    : { events: {}, searches: {} };

  // Build result array
  return emails.map(email => {
    const profile = profiles[email];
    if (!profile) {
      return { email, events: {}, topSearches: [], healthSignals: ['No Mixpanel profile found'] };
    }

    const uid = profile.userId;
    let rawEvents: Record<string, number>;
    let topSearches: string[];

    if (uid && eventData[uid]) {
      rawEvents = eventData[uid];
      topSearches = searchData[uid] ?? [];
    } else if (fallback.events[email]) {
      rawEvents = fallback.events[email];
      topSearches = fallback.searches[email] ?? [];
    } else {
      rawEvents = {};
      topSearches = [];
    }

    const healthSignals: string[] = [];

    const hsContact = hubspotContacts?.find(c => c.email === email);
    const hsLoginRecent = hsContact?.lastLoginDate
      ? (Date.now() - new Date(hsContact.lastLoginDate).getTime()) < 60 * 86_400_000
      : false;

    if ((rawEvents['loginSuccess'] ?? 0) === 0 && !hsLoginRecent) {
      healthSignals.push('No logins in 60 days');
    }
    if ((rawEvents['exportButtonClicked'] ?? 0) > 0 && (rawEvents['contactsExportModalFileDownload'] ?? 0) === 0) {
      healthSignals.push('Export friction: started but never downloaded');
    }
    if ((rawEvents['CreateANewAlertsButtonClicked'] ?? 0) === 0 && (rawEvents['loginSuccess'] ?? 0) > 5) {
      healthSignals.push('No alerts set up despite regular usage');
    }

    return { email, events: rawEvents, topSearches, healthSignals };
  });
}

export function computeHealthTier(
  mixpanel: Array<{ events: Record<string, number> }>
): 'Active' | 'Drifting' | 'At Risk' {
  const totalLogins = mixpanel.reduce((sum, u) => sum + (u.events['loginSuccess'] ?? 0), 0);
  const activeFeatures = mixpanel.reduce((sum, u) => {
    return sum + [
      'episodePlayButtonClicked', 'tellmewhy-launch', 'contactCopied',
      'exportButtonClicked', 'addItemToListClicked',
    ].filter(e => (u.events[e] ?? 0) > 0).length;
  }, 0);

  if (totalLogins >= 10 || (totalLogins >= 5 && activeFeatures >= 2)) return 'Active';
  if (totalLogins >= 1) return 'Drifting';
  return 'At Risk';
}
