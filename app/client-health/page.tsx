'use client';
import { useState } from 'react';
import ClientSearchBar from '@/components/client-health/ClientSearchBar';
import HealthReportView from '@/components/client-health/HealthReportView';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Company { id: string; name: string; domain: string | null }

export default function ClientHealthPage() {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSelect(company: Company) {
    setSelectedCompany(company);
    setReport(null);
    setError('');
    setLoading(true);

    const res = await fetch('/api/hubspot/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id, companyName: company.name }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to load client report.');
      return;
    }
    setReport(await res.json());
  }

  function reset() {
    setSelectedCompany(null);
    setReport(null);
    setError('');
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Client Health</h1>

      {!report && !loading && <ClientSearchBar onSelect={handleSelect} />}
      {loading && <LoadingSpinner message={`Loading report for ${selectedCompany?.name}…`} />}
      {error && !loading && (
        <div>
          <p className="text-gray-500 py-4">{error}</p>
          <button onClick={reset} className="text-xs text-blue-600 hover:underline">← Try another search</button>
        </div>
      )}
      {report && !loading && <HealthReportView report={report} onReset={reset} />}
    </div>
  );
}
