import type { RawDealResult } from '@/lib/deal-scoring';

const BASE = 'https://api.hubapi.com';

export const STAGE_LABELS: Record<string, string> = {
  '10311744':   'Onboarding',
  '1236558246': 'Money Back Window',
  '191321462':  'Basic Pro',
  '10311745':   'Engagement',
  '10311748':   'At Risk',
  '11544543':   'Monthly Renewal',
  '10311746':   'Promised Renewal',
  '12714085':   'Connect/API Deals',
  '8879384':    'Paused/Feature Release',
};

export function stageLabel(stageId: string): string {
  return STAGE_LABELS[stageId] ?? stageId;
}

function headers() {
  return {
    'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
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

const DEAL_PROPS = [
  'dealname', 'dealstage', 'pipeline', 'hubspot_owner_id',
  'contract_start_date', 'contract_end_date', ...ENTITLEMENT_PROPS,
];

// Properties for search/poll list queries (subset — full deal uses DEAL_PROPS)
const SEARCH_PROPS = [
  'dealname', 'dealstage', 'pipeline', 'amount',
  'contract_end_date', 'notes_last_contacted', 'business_type',
  'hubspot_owner_id',
];

function mapDealToRaw(d: { id: string; properties: Record<string, string | null> }): RawDealResult {
  const p = d.properties;
  return {
    id: d.id,
    name: p.dealname ?? '',
    stage: stageLabel(p.dealstage ?? ''),
    pipeline: p.pipeline ?? '',
    amount: p.amount != null && p.amount !== '' ? parseFloat(p.amount) : null,
    contractEndDate: p.contract_end_date ?? null,
    lastContactedDate: p.notes_last_contacted ?? null,
    businessType: p.business_type ?? null,
    company: { id: null, name: '', domain: null },
    ownerId: p.hubspot_owner_id ?? null,
  };
}

// ---- Deal Search ----
// CS reps search by deal name. We know the pipeline and active stages.

export async function searchDeals(name: string): Promise<RawDealResult[]> {
  const token = name.trim().split(/[\s\-()+]+/)
    .filter(w => w.length > 3)
    .sort((a, b) => b.length - a.length)[0] ?? name.trim();

  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups: [{
      filters: [
        { propertyName: 'dealname', operator: 'CONTAINS_TOKEN', value: token },
        { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
        { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
      ],
    }],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    properties: SEARCH_PROPS,
    limit: 20,
  });

  return (result.results ?? []).map(mapDealToRaw);
}

export async function pollDeals(
  type: 'renew_30' | 'renew_60' | 'contacted_45'
): Promise<RawDealResult[]> {
  const now = Date.now();
  const dayMs = 86_400_000;

  let filterGroups: unknown[];

  if (type === 'renew_30') {
    filterGroups = [{
      filters: [
        { propertyName: 'contract_end_date', operator: 'BETWEEN',
          value: String(now), highValue: String(now + 30 * dayMs) },
        { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
        { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
      ],
    }];
  } else if (type === 'renew_60') {
    filterGroups = [{
      filters: [
        { propertyName: 'contract_end_date', operator: 'BETWEEN',
          value: String(now), highValue: String(now + 60 * dayMs) },
        { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
        { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
      ],
    }];
  } else {
    // contacted_45: last contacted more than 45 days ago
    filterGroups = [{
      filters: [
        { propertyName: 'notes_last_contacted', operator: 'LT',
          value: String(now - 45 * dayMs) },
        { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
        { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
      ],
    }];
  }

  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups,
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    properties: SEARCH_PROPS,
    limit: 100,
  });

  return (result.results ?? []).map(mapDealToRaw);
}

export async function fetchDealById(dealId: string) {
  const props = DEAL_PROPS.join(',');
  return hubspotGet(`/crm/v3/objects/deals/${dealId}?properties=${props}`);
}

export async function fetchCompanyForDeal(dealId: string): Promise<{ id: string; name: string; domain: string | null } | null> {
  const assoc = await hubspotGet(`/crm/v3/objects/deals/${dealId}/associations/companies`);
  const companyId = assoc.results?.[0]?.id;
  if (!companyId) return null;
  const c = await hubspotGet(`/crm/v3/objects/companies/${companyId}?properties=name,domain`);
  return { id: companyId, name: c.properties.name ?? '', domain: c.properties.domain ?? null };
}

export async function fetchDealForCompany(companyId: string) {
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
    properties: DEAL_PROPS,
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
      hubspotGet(`/crm/v3/objects/contacts/${id}?properties=firstname,lastname,email,last_login_date,pro_user`)
    )
  );

  return contacts
    .filter((c) => c.properties.pro_user === 'true')
    .map((c) => ({
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
