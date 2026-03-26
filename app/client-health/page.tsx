'use client';
import { useState } from 'react';
import { scoreDealSet, type RawDealResult, type DealResult } from '@/lib/deal-scoring';
import ClientSearchBar from '@/components/client-health/ClientSearchBar';
import PollButtons from '@/components/client-health/PollButtons';
import OwnerFilter from '@/components/client-health/OwnerFilter';
import ResultsDashboard from '@/components/client-health/ResultsDashboard';
import DealResultsList from '@/components/client-health/DealResultsList';
import HealthReportView from '@/components/client-health/HealthReportView';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type Mode = 'idle' | 'search' | 'poll_renew_30' | 'poll_renew_60' | 'poll_contacted_45';

export default function ClientHealthPage() {
  const [mode, setMode]                     = useState<Mode>('idle');
  const [results, setResults]               = useState<DealResult[]>([]);
  const [listLoading, setListLoading]       = useState(false);
  const [listError, setListError]           = useState('');
  const [ownerFilter, setOwnerFilter]       = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal]     = useState<DealResult | null>(null);
  const [report, setReport]                 = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading]   = useState(false);
  const [reportError, setReportError]       = useState('');

  const filteredResults = ownerFilter
    ? results.filter(d => d.ownerId === ownerFilter)
    : results;

  function handleSearchResults(raw: RawDealResult[]) {
    setMode('search');
    setResults(scoreDealSet(raw));
    setListError('');
  }

  async function handlePoll(type: 'renew_30' | 'renew_60' | 'contacted_45') {
    setMode(`poll_${type}` as Mode);  // highlight immediately before fetch
    setListLoading(true);
    setListError('');
    try {
      const res = await fetch('/api/hubspot/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Poll failed');
      setResults(scoreDealSet(data.deals ?? []));
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  }

  async function handleSelectDeal(deal: DealResult) {
    setSelectedDeal(deal);
    setReport(null);
    setReportError('');
    setReportLoading(true);
    try {
      const res = await fetch('/api/hubspot/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load client report.');
      setReport(data);
    } catch (e) {
      setReportError((e as Error).message);
      setSelectedDeal(null);
    } finally {
      setReportLoading(false);
    }
  }

  function handleReset() {
    setSelectedDeal(null);
    setReport(null);
    setReportError('');
  }

  const showHealthReport = !!(selectedDeal && report && !reportLoading);
  const showList         = !selectedDeal && !reportLoading;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#1a1a2e' }}>Client Health</h1>

      <ClientSearchBar onResults={handleSearchResults} disabled={listLoading} />
      <PollButtons activeMode={mode} disabled={listLoading} onPoll={handlePoll} />

      {/* Health report loading/error/view */}
      {reportLoading && selectedDeal && (
        <LoadingSpinner message={`Loading report for ${selectedDeal.name}…`} />
      )}
      {reportError && (
        <p className="text-sm py-4" style={{ color: '#6b7280' }}>{reportError}</p>
      )}
      {showHealthReport && (
        <HealthReportView report={report!} onReset={handleReset} />
      )}

      {/* Results list view */}
      {showList && (
        <>
          {listLoading && <LoadingSpinner message="Loading deals…" />}
          {!listLoading && listError && (
            <p className="text-sm py-4" style={{ color: '#6b7280' }}>{listError}</p>
          )}
          {!listLoading && !listError && results.length > 0 && (
            <>
              <OwnerFilter activeOwner={ownerFilter} onSelect={setOwnerFilter} />
              <ResultsDashboard deals={filteredResults} />
              <DealResultsList deals={filteredResults} onSelect={handleSelectDeal} />
              {filteredResults.length === 0 && (
                <p className="text-sm py-4" style={{ color: '#9ca3af' }}>No deals match this owner.</p>
              )}
            </>
          )}
          {!listLoading && !listError && results.length === 0 && mode !== 'idle' && (
            <p className="text-sm py-4" style={{ color: '#9ca3af' }}>
              {mode === 'search' ? 'No deals found.' : 'No deals match this criterion.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
