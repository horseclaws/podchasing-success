'use client';
import { useState } from 'react';
import HealthTierBadge from './HealthTierBadge';
import FeatureEntitlements from './FeatureEntitlements';
import UserActivityTable from './UserActivityTable';
import ChorusInsights from './ChorusInsights';
import RecentNews from './RecentNews';
import AISummary from './AISummary';

interface Props { report: Record<string, unknown>; onReset: () => void }

export default function HealthReportView({ report, onReset }: Props) {
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  async function saveNote() {
    setSaveError('');
    setSaving(true);
    const res = await fetch('/api/hubspot/note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: (report.deal as Record<string, string>).id,
        dealOwnerId: (report.deal as Record<string, string>).owner,
        companyName: (report.company as Record<string, string>).name,
        aiSummary: report.aiSummary,
        healthTier: report.healthTier,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setSaveError(data.error || 'Failed to save note to HubSpot');
      return;
    }
    const data = await res.json();
    setSavedNote(data.noteId);
  }

  const deal = report.deal as Record<string, unknown>;
  const company = report.company as Record<string, string>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold text-gray-900">{company.name}</h2>
            <HealthTierBadge tier={report.healthTier as 'Active' | 'Drifting' | 'At Risk'} />
          </div>
          <p className="text-xs text-gray-400">
            Owner: {deal.ownerName as string} · Contract: {deal.contractStart as string ?? '?'} → {deal.contractEnd as string ?? '?'}
          </p>
          {!!report.dealOwnerWarning && (
            <p className="text-xs text-yellow-600 mt-1">{report.dealOwnerWarning as string}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveNote}
            disabled={saving || !!savedNote}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
          >
            {saving ? 'Saving…' : savedNote ? `Saved (note ID: ${savedNote})` : 'Save to HubSpot'}
          </button>
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-600">← New search</button>
        </div>
        {saveError && <p className="text-xs text-red-500 mt-1">{saveError}</p>}
      </div>

      <FeatureEntitlements entitlements={deal.entitlements as Record<string, unknown>} />
      <UserActivityTable
        contacts={report.contacts as { name: string; email: string; lastLoginDate: string | null }[]}
        mixpanel={report.mixpanel as { email: string; events: Record<string, number>; topSearches: string[]; healthSignals: string[] }[]}
      />
      <ChorusInsights companyName={company.name} />
      <RecentNews data={null} />
      <AISummary summary={report.aiSummary as string} />
    </div>
  );
}
