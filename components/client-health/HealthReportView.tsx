'use client';
import { useState } from 'react';
import HealthTierBadge from './HealthTierBadge';
import FeatureEntitlements from './FeatureEntitlements';
import UserActivityTable from './UserActivityTable';
import ChorusInsights from './ChorusInsights';
import RecentNews from './RecentNews';
import AISummary from './AISummary';
import type { MixpanelUserActivity } from '@/lib/mixpanel';

interface UsageInfo { used: number; limit: number; resetsAt: string }

interface Props { report: Record<string, unknown>; onReset: () => void }

export default function HealthReportView({ report, onReset }: Props) {
  // Mixpanel enrichment state
  const [mixpanel, setMixpanel]               = useState<MixpanelUserActivity[] | null>(null);
  const [mixpanelLoading, setMixpanelLoading] = useState(false);
  const [mixpanelUsage, setMixpanelUsage]     = useState<UsageInfo | null>(null);
  const [mixpanelError, setMixpanelError]     = useState('');
  const [healthTier, setHealthTier]           = useState<'Active' | 'Drifting' | 'At Risk' | null>(null);

  // Chorus / News trigger state
  const [chorusTriggered, setChorusTriggered] = useState(false);
  const [newsTriggered, setNewsTriggered]     = useState(false);

  // AI summary state
  const [aiSummary, setAiSummary]         = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError]   = useState('');

  // HubSpot save state
  const [saving, setSaving]       = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  const deal    = report.deal as Record<string, unknown>;
  const company = report.company as Record<string, string>;
  const contacts = report.contacts as { name: string; email: string; lastLoginDate: string | null }[];

  async function loadMixpanel() {
    setMixpanelLoading(true);
    setMixpanelError('');
    try {
      const res = await fetch('/api/mixpanel/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      });
      const data = await res.json();
      if (res.status === 429) {
        const resetTime = new Date(data.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMixpanelError(`Mixpanel limit reached for this hour (resets at ${resetTime})`);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Mixpanel fetch failed');
      setMixpanel(data.activity);
      setHealthTier(data.healthTier);
      setMixpanelUsage(data.usage);
    } catch (e) {
      setMixpanelError((e as Error).message);
    } finally {
      setMixpanelLoading(false);
    }
  }

  async function generateSummary() {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const res = await fetch('/api/minimax/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id,
          sources: {
            mixpanel: mixpanel !== null,
            chorus: chorusTriggered,
            news: newsTriggered,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Summary generation failed');
      setAiSummary(data.summary);
    } catch (e) {
      setSummaryError((e as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function saveNote() {
    setSaveError('');
    setSaving(true);
    try {
      const res = await fetch('/api/hubspot/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id,
          dealOwnerId: deal.owner,
          companyName: company.name,
          aiSummary,
          healthTier: healthTier ?? 'Unknown',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error || 'Failed to save note to HubSpot');
        return;
      }
      const data = await res.json();
      setSavedNote(data.noteId);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const limitReached = mixpanelUsage && mixpanelUsage.used >= mixpanelUsage.limit;

  return (
    <div className="space-y-5">

      {/* Company header */}
      <div className="rounded-2xl p-5 flex items-start justify-between" style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 12px rgba(74,2,125,0.08)', border: '1px solid #ede9f5' }}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold" style={{ color: '#1a1a2e' }}>{company.name}</h2>
            {healthTier && <HealthTierBadge tier={healthTier} />}
          </div>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            Owner: {deal.ownerName as string} · Contract: {deal.contractStart as string ?? '?'} → {deal.contractEnd as string ?? '?'}
          </p>
          {!!report.dealOwnerWarning && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#d97706' }}>{report.dealOwnerWarning as string}</p>
          )}
        </div>
        <button onClick={onReset} className="text-xs font-medium transition-opacity hover:opacity-60" style={{ color: '#9ca3af' }}>← New search</button>
      </div>

      <FeatureEntitlements entitlements={deal.entitlements as Record<string, unknown>} />

      {/* User Activity — contacts-only until Mixpanel loads */}
      <UserActivityTable contacts={contacts} mixpanel={mixpanel} />

      {/* Mixpanel enrichment section */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A027D' }}>Mixpanel Activity</p>
            {mixpanelUsage && (
              <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                {mixpanelUsage.used} of {mixpanelUsage.limit} calls used this hour
              </p>
            )}
          </div>
          {!mixpanel && (
            <button
              onClick={loadMixpanel}
              disabled={mixpanelLoading || !!limitReached}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#4A027D', color: '#ffffff' }}
            >
              {mixpanelLoading ? 'Loading…' : 'Load Mixpanel'}
            </button>
          )}
          {mixpanel && (
            <span className="text-xs font-medium" style={{ color: '#2BDA9F' }}>✓ Loaded</span>
          )}
        </div>
        {mixpanelError && (
          <p className="text-xs mt-2" style={{ color: '#d97706' }}>{mixpanelError}</p>
        )}
      </div>

      {/* Chorus Insights section */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A027D' }}>Chorus Insights</p>
          {!chorusTriggered && (
            <button
              onClick={() => setChorusTriggered(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#4A027D', color: '#ffffff' }}
            >
              Load Chorus
            </button>
          )}
          {chorusTriggered && (
            <span className="text-xs font-medium" style={{ color: '#2BDA9F' }}>✓ Loaded</span>
          )}
        </div>
        {chorusTriggered && <ChorusInsights companyName={company.name} />}
      </div>

      {/* Recent News section */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A027D' }}>Recent News</p>
          {!newsTriggered && (
            <button
              onClick={() => setNewsTriggered(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#4A027D', color: '#ffffff' }}
            >
              Load News
            </button>
          )}
          {newsTriggered && (
            <span className="text-xs font-medium" style={{ color: '#2BDA9F' }}>✓ Loaded</span>
          )}
        </div>
        {newsTriggered && <RecentNews companyName={company.name} />}
      </div>

      {/* AI Summary section */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A027D' }}>AI Summary</p>
        <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>
          Will include: HubSpot data
          {mixpanel !== null && ' + Mixpanel ✓'}
          {chorusTriggered && ' + Chorus ✓'}
          {newsTriggered && ' + News ✓'}
        </p>
        {!aiSummary && (
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#4A027D', color: '#ffffff' }}
          >
            {summaryLoading ? 'Generating…' : 'Generate AI Summary'}
          </button>
        )}
        {summaryError && (
          <>
            <p className="text-xs mt-2" style={{ color: '#FB0467' }}>{summaryError}</p>
            <button
              onClick={generateSummary}
              className="text-xs font-medium mt-1"
              style={{ color: '#4A027D' }}
            >
              Retry
            </button>
          </>
        )}
        {aiSummary && (
          <>
            <AISummary summary={aiSummary} />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={saveNote}
                disabled={saving || !!savedNote}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{ border: '1px solid #ede9f5', color: savedNote ? '#2BDA9F' : '#4A027D', backgroundColor: savedNote ? 'rgba(43,218,159,0.08)' : '#ffffff' }}
              >
                {saving ? 'Saving…' : savedNote ? '✓ Saved to HubSpot' : 'Save to HubSpot'}
              </button>
              {saveError && <p className="text-xs" style={{ color: '#FB0467' }}>{saveError}</p>}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
