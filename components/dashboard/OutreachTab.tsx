// components/dashboard/OutreachTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DashboardDeal } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type Days = 30 | 45 | 60;

interface Props {
  ownerId: string;
  showOwnerColumn: boolean;
}

export default function OutreachTab({ ownerId, showOwnerColumn }: Props) {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<DashboardDeal[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);

  const load = useCallback(async (bust = false) => {
    const key = dashboardCacheKey('outreach', ownerId, days);
    if (bust) cacheClear(key);
    const cached = cacheGet<DashboardDeal[]>(key);
    if (cached) { setData(cached); setAgeMinutes(cacheAge(key)); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/dashboard/outreach?days=${days}&ownerId=${ownerId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      cacheSet(key, json); setData(json); setAgeMinutes(0);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [ownerId, days]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never';
  const daysSince = (d: string | null) =>
    d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([30, 45, 60] as Days[]).map(d => (
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

      {loading && <LoadingSpinner message="Loading outreach gaps…" />}
      {error && <p className="text-sm text-gray-500 py-4">{error}</p>}
      {data && !loading && (
        data.length === 0
          ? <p className="text-sm text-gray-400 py-4">No deals beyond {days} days without contact.</p>
          : <div className="rounded-2xl border border-violet-100 overflow-hidden">
              {data.map((deal, i) => (
                <a
                  key={deal.id}
                  href={`/client-health?dealId=${deal.id}`}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors ${i > 0 ? 'border-t border-violet-50' : ''}`}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{deal.name}</p>
                    {showOwnerColumn && (
                      <p className="text-xs text-gray-400">{deal.ownerName}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-700">{fmtDate(deal.lastContactedDate)}</p>
                    {daysSince(deal.lastContactedDate) != null && (
                      <p className="text-xs text-red-400">{daysSince(deal.lastContactedDate)}d ago</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
      )}
    </div>
  );
}
