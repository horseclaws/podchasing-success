const BASE = 'https://api.hubapi.com';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

// ---- Company Search ----

export async function searchCompanies(name: string) {
  // 1. Exact company name match
  const exact = await hubspotPost('/crm/v3/objects/companies/search', {
    filterGroups: [{
      filters: [{ propertyName: 'name', operator: 'EQ', value: name }],
    }],
    properties: ['name', 'domain'],
    limit: 10,
  });
  if (exact.results?.length > 0) return exact.results as HubSpotCompanyResult[];

  // 2. Fuzzy company name match
  const fuzzy = await hubspotPost('/crm/v3/objects/companies/search', {
    filterGroups: [{
      filters: [{ propertyName: 'name', operator: 'CONTAINS_TOKEN', value: name }],
    }],
    properties: ['name', 'domain'],
    limit: 10,
  });
  if (fuzzy.results?.length > 0) return fuzzy.results as HubSpotCompanyResult[];

  // 3. Contact name fallback — search contacts, return their associated companies
  return searchCompaniesByContactName(name);
}

async function searchCompaniesByContactName(name: string): Promise<HubSpotCompanyResult[]> {
  const parts = name.trim().split(/\s+/);
  const filters = parts.length >= 2
    ? [
        { propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: parts[0] },
        { propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: parts[parts.length - 1] },
      ]
    : [{ propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: name }];

  const contacts = await hubspotPost('/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters }],
    properties: ['firstname', 'lastname', 'email'],
    limit: 5,
  });

  if (!contacts.results?.length) return [];

  // Get companies associated with each contact
  const companyIds = new Set<string>();
  await Promise.all(
    contacts.results.map(async (c: { id: string }) => {
      try {
        const assoc = await hubspotGet(`/crm/v3/objects/contacts/${c.id}/associations/companies`);
        for (const r of assoc.results ?? []) companyIds.add(r.id);
      } catch { /* skip */ }
    })
  );

  if (companyIds.size === 0) return [];

  const companies = await Promise.all(
    [...companyIds].slice(0, 5).map((id) =>
      hubspotGet(`/crm/v3/objects/companies/${id}?properties=name,domain`)
    )
  );

  return companies.map((c) => ({
    id: c.id,
    properties: { name: c.properties.name ?? '', domain: c.properties.domain ?? null },
  }));
}

interface HubSpotCompanyResult {
  id: string;
  properties: { name: string; domain: string | null };
}

// ---- Deal Fetch ----

const PIPELINE_ID = '10311743';

// Active stages in the Renewals-Pro pipeline (excludes Renewed, Churned, MBG Loss)
const VALID_STAGES = [
  '10311744', // Onboarding
  '1236558246', // Money Back Window
  '191321462', // Basic Pro
  '10311745', // Engagement
  '10311748', // At Risk
  '11544543', // Monthly Renewal
  '10311746', // Promised Renewal
  '12714085', // Connect/API Deals
  '8879384', // Paused/Feature Release
];

const ENTITLEMENT_PROPS = [
  'brand_safety', 'sponsor_history', 'transcript_search', 'tell_me_why',
  'political_skew', 'list_making', 'seats', 'alerts',
];

export async function fetchDealForCompany(companyId: string) {
  const dealProps = [
    'dealname', 'dealstage', 'pipeline', 'hubspot_owner_id',
    'contract_start_date', 'contract_end_date', ...ENTITLEMENT_PROPS,
  ];

  // Search for the most recently modified active deal in the Renewals-Pro pipeline
  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups: [{
      filters: [
        { propertyName: 'associations.company', operator: 'EQ', value: companyId },
        { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
        { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
      ],
    }],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    properties: dealProps,
    limit: 1,
  });

  return result.results?.[0] ?? null;
}

// ---- Contacts ----

export async function fetchContactsForDeal(dealId: string) {
  const assoc = await hubspotGet(
    `/crm/v3/objects/deals/${dealId}/associations/contacts`
  );
  const contactIds: string[] = (assoc.results ?? []).map((r: { id: string }) => r.id);
  if (contactIds.length === 0) return [];

  const contacts = await Promise.all(
    contactIds.map((id) =>
      hubspotGet(`/crm/v3/objects/contacts/${id}?properties=firstname,lastname,email,last_login_date`)
    )
  );

  return contacts.map((c) => ({
    id: c.id,
    name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' '),
    email: c.properties.email ?? '',
    lastLoginDate: c.properties.last_login_date ?? null,
  }));
}

// ---- Notes ----

const PARROTBOT_MARKER = 'ParrotBot';

export async function fetchNotesForDeal(dealId: string) {
  const assoc = await hubspotGet(
    `/crm/v3/objects/deals/${dealId}/associations/notes`
  );
  const noteIds: string[] = (assoc.results ?? []).map((r: { id: string }) => r.id).slice(0, 20);
  if (noteIds.length === 0) return [];

  const notes = await Promise.all(
    noteIds.map((id) =>
      hubspotGet(`/crm/v3/objects/notes/${id}?properties=hs_note_body,hs_timestamp`)
    )
  );

  const sorted = notes
    .sort((a, b) => new Date(b.properties.hs_timestamp).getTime() - new Date(a.properties.hs_timestamp).getTime())
    .slice(0, 3);

  return sorted.map((n) => {
    const body: string = n.properties.hs_note_body ?? '';
    const isParrotBot = body.includes(PARROTBOT_MARKER);
    return {
      id: n.id,
      body: isParrotBot ? '[ParrotBot report — skipped]' : body.slice(0, 500),
      timestamp: n.properties.hs_timestamp,
      isParrotBot,
    };
  });
}

// ---- Emails ----

export async function fetchEmailsForDeal(dealId: string) {
  const assoc = await hubspotGet(
    `/crm/v3/objects/deals/${dealId}/associations/emails`
  );
  const emailIds: string[] = (assoc.results ?? []).map((r: { id: string }) => r.id).slice(0, 20);
  if (emailIds.length === 0) return [];

  const emails = await Promise.all(
    emailIds.map((id) =>
      hubspotGet(`/crm/v3/objects/emails/${id}?properties=hs_email_subject,hs_email_text,hs_timestamp`)
    )
  );

  const sorted = emails
    .sort((a, b) => new Date(b.properties.hs_timestamp).getTime() - new Date(a.properties.hs_timestamp).getTime())
    .slice(0, 3);

  return sorted.map((e) => {
    const body: string = (e.properties.hs_email_text ?? '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/(-{3,}|_{3,}|\n{4,})/g, '')
      .trim()
      .slice(0, 800);
    return {
      id: e.id,
      subject: e.properties.hs_email_subject ?? '',
      body,
      timestamp: e.properties.hs_timestamp,
    };
  });
}

// ---- Note Write-Back ----

export async function writeHealthNote(dealId: string, body: string, ownerOwnerId: string) {
  const note = await hubspotPost('/crm/v3/objects/notes', {
    properties: {
      hs_note_body: body,
      hs_timestamp: new Date().toISOString(),
      hubspot_owner_id: ownerOwnerId,
    },
  });

  const noteId = note.id;

  await hubspotPost('/crm/v3/associations/notes/deals/batch/create', {
    inputs: [{ from: { id: noteId }, to: { id: dealId }, type: 'note_to_deal' }],
  });

  return noteId;
}

// ---- Owner Name Map ----

const OWNER_NAMES: Record<string, string> = {
  '1774818015': 'Jon Dispenza',
  '184892201': 'Jules Thill',
  '157100429': 'Sydney Stern',
};

export function ownerName(ownerId: string): string {
  return OWNER_NAMES[ownerId] ?? `Owner ${ownerId}`;
}

// ---- HTTP helpers ----

async function hubspotGet(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`HubSpot GET ${path} failed: ${res.status}`);
  return res.json();
}

async function hubspotPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot POST ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}
