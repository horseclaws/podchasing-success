// components/dashboard/UserSidePanel.tsx
'use client';
import { useState } from 'react';
import type { DashboardContact, DashboardDeal, LoginTier, EmailDraftContext } from '@/lib/dashboard';
import type { MixpanelUserActivity } from '@/lib/mixpanel';

type DraftType = EmailDraftContext['type'];

const TIER_BADGE: Record<LoginTier, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-amber-100 text-amber-700',
  Ghost: 'bg-red-100 text-red-700',
};

const DRAFT_LABELS: Record<DraftType, string> = {
  inactive_user: 'Inactive User',
  open_seats: 'Open Seats',
  renewal: 'Renewal',
};

// Types that are not yet ready — shown greyed out and non-selectable
const DISABLED_DRAFT_TYPES = new Set<DraftType>(['renewal']);

const ENGAGEMENT_APP_URL = 'https://ai.studio/apps/0257187b-c49f-49c8-806c-356fc68f4480?fullscreenApplet=true';

interface Props {
  contact: DashboardContact;
  deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>;
  onClose: () => void;
}

export default function UserSidePanel({ contact, deal, onClose }: Props) {
  const [mixpanel, setMixpanel] = useState<MixpanelUserActivity | null>(null);
  const [mixpanelLoading, setMixpanelLoading] = useState(false);
  const [draftType, setDraftType] = useState<DraftType>('inactive_user');
  const [draft, setDraft] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function pullMixpanel() {
    setMixpanelLoading(true);
    try {
      const res = await fetch('/api/mixpanel/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [contact.email] }),
      });
      const data = await res.json();
      if (res.ok) setMixpanel(data[0] ?? null);
    } finally {
      setMixpanelLoading(false);
    }
  }

  async function generateDraft() {
    setDraftLoading(true);
    setDraft(null);
    try {
      const ctx: EmailDraftContext = {
        type: draftType,
        deal: { company: deal.name, renewalDate: deal.contractEndDate, amount: deal.amount, stage: deal.stage },
        contact: { name: contact.name, title: contact.title, lastLogin: contact.lastLoginDate, tier: contact.tier },
        mixpanel: mixpanel ?? undefined,
      };
      const res = await fetch('/api/dashboard/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ctx),
      });
      const data = await res.json();
      if (res.ok) setDraft(data.draft);
    } finally {
      setDraftLoading(false);
    }
  }

  async function copy() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-foreground">{contact.name || '—'}</h2>
            {contact.title && <p className="text-xs text-brand-purple mt-0.5">{contact.title}</p>}
            <p className="text-xs text-gray-400 mt-0.5">{deal.name}</p>
            <p className="text-sm text-gray-500 mt-0.5">{contact.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">&times;</button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Deal context */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Deal</p>
            <p className="text-sm font-medium">{deal.name}</p>
            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
              <p>Stage: {deal.stage}</p>
              {deal.amount != null && <p>Value: ${deal.amount.toLocaleString()}</p>}
              {fmtDate(deal.contractEndDate) && <p>Renewal: {fmtDate(deal.contractEndDate)}</p>}
            </div>
          </section>

          {/* Login status */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Login Status</p>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_BADGE[contact.tier]}`}>
                {contact.tier}
              </span>
              <span className="text-xs text-gray-500">
                {fmtDate(contact.lastLoginDate) ? `Last: ${fmtDate(contact.lastLoginDate)}` : 'Never logged in'}
              </span>
            </div>
          </section>

          {/* Mixpanel */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Product Activity</p>
            {!mixpanel ? (
              <button
                onClick={pullMixpanel}
                disabled={mixpanelLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-brand-purple font-medium hover:bg-violet-100 disabled:opacity-50"
              >
                {mixpanelLoading ? 'Loading…' : 'Pull Mixpanel'}
              </button>
            ) : (
              <div className="space-y-1 text-xs text-gray-600">
                {([['Logins', 'loginSuccess'], ['Exports', 'exportButtonClicked'], ['Searches', 'TopSearchSubmit']] as [string, string][]).map(([label, key]) => (
                  <div key={key} className="flex justify-between">
                    <span>{label}</span>
                    <span className="font-medium">{mixpanel.events[key] ?? 0}</span>
                  </div>
                ))}
                {mixpanel.topSearches.length > 0 && (
                  <p className="text-gray-400 mt-1">Searches: {mixpanel.topSearches.slice(0, 5).join(', ')}</p>
                )}
                {mixpanel.healthSignals.map(s => (
                  <p key={s} className="text-amber-600 mt-0.5">⚠ {s}</p>
                ))}
              </div>
            )}
          </section>

          {/* Email draft */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Generate Draft</p>
            <div className="flex gap-1 flex-wrap mb-3">
              {(Object.keys(DRAFT_LABELS) as DraftType[]).map(t => {
                const disabled = DISABLED_DRAFT_TYPES.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => !disabled && setDraftType(t)}
                    disabled={disabled}
                    title={disabled ? 'Coming soon' : undefined}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      disabled
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : draftType === t
                        ? 'bg-brand-purple text-white'
                        : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
                    }`}
                  >
                    {DRAFT_LABELS[t]}
                  </button>
                );
              })}
              <a
                href={ENGAGEMENT_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2.5 py-1 rounded-full font-medium bg-violet-50 text-brand-purple hover:bg-violet-100 transition-colors"
              >
                Engagement ↗
              </a>
            </div>
            <button
              onClick={generateDraft}
              disabled={draftLoading}
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-brand-purple text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {draftLoading ? 'Generating…' : 'Generate Draft'}
            </button>
            {draft && (
              <div className="mt-3">
                <textarea
                  readOnly
                  value={draft}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none h-44 text-gray-700 leading-relaxed"
                />
                <button
                  onClick={copy}
                  className="mt-1.5 w-full text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-brand-purple font-medium hover:bg-violet-100"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </section>

          {/* HubSpot link */}
          <a
            href={contact.hubspotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-xs px-3 py-2 rounded-lg border border-violet-200 text-brand-purple font-medium hover:bg-violet-50"
          >
            Open in HubSpot →
          </a>
        </div>
      </div>
    </>
  );
}
