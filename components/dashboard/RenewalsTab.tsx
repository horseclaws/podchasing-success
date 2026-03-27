// components/dashboard/RenewalsTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DealWithQuote, DashboardContact, DashboardDeal } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import RenewalDealCard from './RenewalDealCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type Days = 30 | 60 | 90;

interface Props {
  ownerId: string;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

export default function RenewalsTab({ ownerId, onContactClick }: Props) {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<DealWithQuote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);

  const load = useCallback(async (bust = false) => {
    const key = dashboardCacheKey('renewals', ownerId, days);
    if (bust) cacheClear(key);
    const cached = cacheGet<DealWithQuote[]>(key);
    if (cached) { setData(cached); setAgeMinutes(cacheAge(key)); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/dashboard/renewals?days=${days}&ownerId=${ownerId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      cacheSet(key, json); setData(json); setAgeMinutes(0);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [ownerId, days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([30, 60, 90] as Days[]).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                days === d ? 'bg-brand-purple text-white' : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
        <button onClick={() => load(true)} className="text-xs text-gray-400 hover:text-brand-purple">
          {ageMinutes != null ? `Updated ${ageMinutes}m ago · ` : ''}Refresh
        </button>
      </div>

      {loading && <LoadingSpinner message="Loading renewals…" />}
      {error && <p className="text-sm text-gray-500 py-4">{error}</p>}
      {data && !loading && (
        data.length === 0
          ? <p className="text-sm text-gray-400 py-4">No deals renewing in {days} days.</p>
          : <div className="space-y-3">
              {data.map(deal => (
                <RenewalDealCard key={deal.id} deal={deal} onContactClick={onContactClick} />
              ))}
            </div>
      )}
    </div>
  );
}
