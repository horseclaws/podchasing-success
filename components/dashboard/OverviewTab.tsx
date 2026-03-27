// components/dashboard/OverviewTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { SummaryData, LoginTier } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import SeatTierStat from './SeatTierStat';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

function DistributionTile({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;
  const colors = ['bg-brand-purple', 'bg-brand-cyan', 'bg-brand-mint', 'bg-brand-pink'];
  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">{title}</p>
      <div className="space-y-2">
        {entries.map(([label, count], i) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-700">{label}</span>
              <span className="text-gray-400">{count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-violet-50">
              <div className={`h-1.5 rounded-full ${colors[i % colors.length]}`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  ownerId: string;
  onNavigateToSeats: (tier: LoginTier) => void;
}

export default function OverviewTab({ ownerId, onNavigateToSeats }: Props) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);
  const key = dashboardCacheKey('overview', ownerId);

  const load = useCallback(async (bust = false) => {
    if (bust) cacheClear(key);
    const cached = cacheGet<SummaryData>(key);
    if (cached) { setData(cached); setAgeMinutes(cacheAge(key)); return; }
    setLoading(true); setError('');
    try {
      const params = ownerId !== 'all' ? `?ownerId=${ownerId}` : '?ownerId=all';
      const res = await fetch(`/api/dashboard/summary${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      cacheSet(key, json); setData(json); setAgeMinutes(0);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [ownerId, key]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner message="Loading overview…" />;
  if (!data) return (
    error ? (
      <div className="space-y-2 py-4">
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={() => load(true)} className="text-xs text-gray-400 hover:text-brand-purple">Refresh</button>
      </div>
    ) : null
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => load(true)} className="text-xs text-gray-400 hover:text-brand-purple">
          {ageMinutes != null ? `Updated ${ageMinutes}m ago · ` : ''}Refresh
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Deals', value: data.totalDeals },
          { label: 'Contract Value', value: `$${data.totalContractValue.toLocaleString()}` },
          { label: 'Total Seats', value: data.totalSeats },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 bg-white border border-violet-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(['Active', 'Inactive', 'Ghost'] as LoginTier[]).map(tier => (
          <SeatTierStat
            key={tier}
            tier={tier}
            count={tier === 'Active' ? data.activeContacts : tier === 'Inactive' ? data.inactiveContacts : data.ghostContacts}
            onClick={onNavigateToSeats}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DistributionTile title="By Deal Stage" counts={data.byStage} />
        <DistributionTile title="By Business Type" counts={data.byBusinessType} />
      </div>
    </div>
  );
}
