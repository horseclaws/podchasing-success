// components/dashboard/RenewalsTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DealWithQuote, DashboardContact, DashboardDeal } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import RenewalDealCard from './RenewalDealCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type Days = 30 | 60 | 90;
const ALL_DAYS: Days[] = [30, 60, 90];

interface Props {
  ownerId: string;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

async function fetchWindow(days: Days, ownerId: string): Promise<DealWithQuote[]> {
  const key = dashboardCacheKey('renewals', ownerId, days);
  const cached = cacheGet<DealWithQuote[]>(key);
  if (cached) return cached;
  const res = await fetch(`/api/dashboard/renewals?days=${days}&ownerId=${ownerId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed');
  cacheSet(key, json);
  return json;
}

export default function RenewalsTab({ ownerId, onContactClick }: Props) {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<DealWithQuote[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<Days, number>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);

  const loadCounts = useCallback(async () => {
    const results = await Promise.allSettled(
      ALL_DAYS.map(d => fetchWindow(d, ownerId))
    );
    const next: Partial<Record<Days, number>> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next[ALL_DAYS[i]] = r.value.length;
    });
    setCounts(next);
  }, [ownerId]);

  const load = useCallback(async (bust = false) => {
    const key = dashboardCacheKey('renewals', ownerId, days);
    if (bust) {
      ALL_DAYS.forEach(d => cacheClear(dashboardCacheKey('renewals', ownerId, d)));
    }
    const cached = cacheGet<DealWithQuote[]>(key);
    if (cached) { setData(cached); setAgeMinutes(cacheAge(key)); loadCounts(); return; }
    setLoading(true); setError('');
    try {
      const json = await fetchWindow(days, ownerId);
      setData(json); setAgeMinutes(0);
      loadCounts();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [ownerId, days, loadCounts]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {ALL_DAYS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                days === d ? 'bg-brand-purple text-white' : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
              }`}
            >
              {d}d{counts[d] != null ? ` (${counts[d]})` : ''}
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
        data.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-8 text-center">
            <p className="text-2xl mb-1">✨</p>
            <p className="text-sm font-semibold text-emerald-700">No renewals in the next {days} days.</p>
            <p className="text-xs text-emerald-600 mt-0.5">Enjoy the calm.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map(deal => (
              <RenewalDealCard key={deal.id} deal={deal} onContactClick={onContactClick} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
