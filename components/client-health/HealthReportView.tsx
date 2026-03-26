'use client';
import { useState } from 'react';
import HealthTierBadge from './HealthTierBadge';
import FeatureEntitlements from './FeatureEntitlements';
import UserActivityTable from './UserActivityTable';
import ChorusInsights from './ChorusInsights';
import RecentNews from './RecentNews';
import AISummary from './AISummary';
import InsightCard from '@/components/ui/InsightCard';
import type { MixpanelUserActivity } from '@/lib/mixpanel';

interface UsageInfo { used: number; limit: number; resetsAt: string }
interface Props { report: Record<string, unknown>; onReset: () => void }

export default function HealthReportView({ report, onReset }: Props) {
  const [mixpanel, setMixpanel]               = useState<MixpanelUserActivity[] | null>(null);
  const [mixpanelLoading, setMixpanelLoading] = useState(false);
  const [mixpanelUsage, setMixpanelUsage]     = useState<UsageInfo | null>(null);
  const [mixpanelError, setMixpanelError]     = useState('');
  const [healthTier, setHealthTier]           = useState<'Active' | 'Drifting' | 'At Risk' | null>(null);

  const [chorusTriggered, setChorusTriggered] = useState(false);
  const [newsTriggered, setNewsTriggered]     = useState(false);

  const [aiSummary, setAiSummary]           = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError]     = useState('');

  const [saving, setSaving]       = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  const deal     = report.deal as Record<string, unknown>;
  const company  = report.company as Record<string, string>;
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
          sources: { mixpanel: mixpanel !== null, chorus: chorusTriggered, news: newsTriggered },
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
      <InsightCard>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-foreground">{company.name}</h2>
              {healthTier && <HealthTierBadge tier={healthTier} />}
            </div>
            <p className="text-xs text-gray-400">
              Owner: {deal.ownerName as string} · Contract: {deal.contractStart as string ?? '?'} → {deal.contractEnd as string ?? '?'}
            </p>
            {!!report.dealOwnerWarning && (
              <p className="text-xs mt-1 font-medium text-amber-600">{report.dealOwnerWarning as string}</p>
            )}
          </div>
          <button onClick={onReset} className="text-xs font-medium text-gray-400 hover:opacity-60 transition-opacity">← New search</button>
        </div>
      </InsightCard>

      <FeatureEntitlements entitlements={deal.entitlements as Record<string, unknown>} />
      <UserActivityTable contacts={contacts} mixpanel={mixpanel} />

      {/* Mixpanel */}
      <InsightCard className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Mixpanel Activity</p>
            {mixpanelUsage && (
              <p className="text-xs mt-0.5 text-gray-400">
                {mixpanelUsage.used} of {mixpanelUsage.limit} calls used this hour
              </p>
            )}
          </div>
          {!mixpanel && (
            <button
              onClick={loadMixpanel}
              disabled={mixpanelLoading || !!limitReached}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-purple text-white transition-opacity disabled:opacity-50"
            >
              {mixpanelLoading ? 'Loading…' : 'Load Mixpanel'}
            </button>
          )}
          {mixpanel && <span className="text-xs font-medium text-brand-mint">✓ Loaded</span>}
        </div>
        {mixpanelError && <p className="text-xs mt-2 text-amber-600">{mixpanelError}</p>}
      </InsightCard>

      {/* Chorus */}
      <InsightCard className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Chorus Insights</p>
          {!chorusTriggered && (
            <button
              onClick={() => setChorusTriggered(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-purple text-white"
            >
              Load Chorus
            </button>
          )}
          {chorusTriggered && <span className="text-xs font-medium text-brand-mint">✓ Loaded</span>}
        </div>
        {chorusTriggered && <ChorusInsights companyName={company.name} />}
      </InsightCard>

      {/* News */}
      <InsightCard className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Recent News</p>
          {!newsTriggered && (
            <button
              onClick={() => setNewsTriggered(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-purple text-white"
            >
              Load News
            </button>
          )}
          {newsTriggered && <span className="text-xs font-medium text-brand-mint">✓ Loaded</span>}
        </div>
        {newsTriggered && <RecentNews companyName={company.name} />}
      </InsightCard>

      {/* AI Summary */}
      <InsightCard className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-brand-purple">AI Summary</p>
        <p className="text-xs mb-3 text-gray-400">
          Will include: HubSpot data
          {mixpanel !== null && ' + Mixpanel ✓'}
          {chorusTriggered && ' + Chorus ✓'}
          {newsTriggered && ' + News ✓'}
        </p>
        {!aiSummary && (
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-purple text-white disabled:opacity-50"
          >
            {summaryLoading ? 'Generating…' : 'Generate AI Summary'}
          </button>
        )}
        {summaryError && (
          <>
            <p className="text-xs mt-2 text-brand-pink">{summaryError}</p>
            <button onClick={generateSummary} className="text-xs font-medium mt-1 text-brand-purple">Retry</button>
          </>
        )}
        {aiSummary && (
          <>
            <AISummary summary={aiSummary} />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={saveNote}
                disabled={saving || !!savedNote}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                  savedNote
                    ? 'border-violet-100 text-brand-mint bg-green-50'
                    : 'border-violet-100 text-brand-purple bg-white'
                }`}
              >
                {saving ? 'Saving…' : savedNote ? '✓ Saved to HubSpot' : 'Save to HubSpot'}
              </button>
              {saveError && <p className="text-xs text-brand-pink">{saveError}</p>}
            </div>
          </>
        )}
      </InsightCard>

    </div>
  );
}
