// components/dashboard/OutreachTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DealWithContacts, DashboardContact, DashboardDeal } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import ContactChip from './ContactChip';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type Days = 30 | 45 | 60;
const ALL_DAYS: Days[] = [30, 45, 60];

interface Props {
  ownerId: string;
  showOwnerColumn: boolean;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

async function fetchWindow(days: Days, ownerId: string): Promise<DealWithContacts[]> {
  const key = dashboardCacheKey('outreach', ownerId, days);
  const cached = cacheGet<DealWithContacts[]>(key);
  if (cached) return cached;
  const res = await fetch(`/api/dashboard/outreach?days=${days}&ownerId=${ownerId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed');
  cacheSet(key, json);
  return json;
}

export default function OutreachTab({ ownerId, showOwnerColumn, onContactClick }: Props) {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<DealWithContacts[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<Days, number>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
    const key = dashboardCacheKey('outreach', ownerId, days);
    if (bust) {
      ALL_DAYS.forEach(d => cacheClear(dashboardCacheKey('outreach', ownerId, d)));
    }
    const cached = cacheGet<DealWithContacts[]>(key);
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

  const toggle = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never';
  const daysSince = (d: string | null) =>
    d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;

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

      {loading && <LoadingSpinner message="Loading outreach gaps…" />}
      {error && <p className="text-sm text-gray-500 py-4">{error}</p>}

      {data && !loading && (
        data.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-8 text-center">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-sm font-semibold text-emerald-700">All caught up!</p>
            <p className="text-xs text-emerald-600 mt-0.5">No deals need outreach beyond {days} days.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map(deal => {
              const dealSnap = { id: deal.id, name: deal.name, stage: deal.stage, amount: deal.amount, contractEndDate: deal.contractEndDate };
              const isOpen = expanded.has(deal.id);
              const since = daysSince(deal.lastContactedDate);
              return (
                <div key={deal.id} className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
                  <button
                    onClick={() => toggle(deal.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{deal.name}</p>
                      {showOwnerColumn && (
                        <p className="text-xs text-gray-400">{deal.ownerName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-700">{fmtDate(deal.lastContactedDate)}</p>
                        {since != null && (
                          <p className="text-xs text-red-400">{since}d ago</p>
                        )}
                      </div>
                      <span className="text-gray-300">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 pt-1 border-t border-violet-50">
                      {deal.contacts.length === 0 ? (
                        <p className="text-xs text-gray-400">No pro users assigned.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {deal.contacts.map(c => (
                            <ContactChip key={c.id} contact={c} deal={dealSnap} onClick={onContactClick} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
