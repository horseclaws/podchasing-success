// components/dashboard/SeatsTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DealWithContacts, DashboardContact, DashboardDeal, LoginTier } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import ContactChip from './ContactChip';
import SeatTierStat from './SeatTierStat';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Props {
  ownerId: string;
  initialTierFilter?: LoginTier | null;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

export default function SeatsTab({ ownerId, initialTierFilter, onContactClick }: Props) {
  const [data, setData] = useState<DealWithContacts[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);
  const [tierFilter, setTierFilter] = useState<LoginTier | null>(initialTierFilter ?? null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const key = dashboardCacheKey('seats', ownerId);

  const load = useCallback(async (bust = false) => {
    if (bust) cacheClear(key);
    const cached = cacheGet<DealWithContacts[]>(key);
    if (cached) { setData(cached); setAgeMinutes(cacheAge(key)); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/dashboard/seats?ownerId=${ownerId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      cacheSet(key, json); setData(json); setAgeMinutes(0);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [ownerId, key]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const filteredData = tierFilter
    ? data?.map(d => ({ ...d, contacts: d.contacts.filter(c => c.tier === tierFilter) })).filter(d => d.contacts.length > 0)
    : data;

  const allContacts = data?.flatMap(d => d.contacts) ?? [];
  const active = allContacts.filter(c => c.tier === 'Active').length;
  const inactive = allContacts.filter(c => c.tier === 'Inactive').length;
  const ghost = allContacts.filter(c => c.tier === 'Ghost').length;
  const totalSeats = data?.reduce((s, d) => s + d.seats, 0) ?? 0;
  const totalAssigned = allContacts.length;
  const openSeats = totalSeats - totalAssigned;

  if (loading) return <LoadingSpinner message="Loading seats…" />;
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

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Seats', value: totalSeats },
          { label: 'Assigned', value: totalAssigned },
          { label: 'Open Seats', value: Math.max(0, openSeats) },
          { label: 'Inactive Pro Users', value: inactive + ghost },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 bg-white border border-violet-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tier filter */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 flex-1">
          {(['Active', 'Inactive', 'Ghost'] as LoginTier[]).map(tier => (
            <SeatTierStat
              key={tier}
              tier={tier}
              count={tier === 'Active' ? active : tier === 'Inactive' ? inactive : ghost}
              onClick={t => setTierFilter(prev => prev === t ? null : t)}
            />
          ))}
        </div>
        {tierFilter && (
          <button onClick={() => setTierFilter(null)} className="text-xs text-gray-400 hover:text-brand-purple whitespace-nowrap">
            Clear filter
          </button>
        )}
      </div>

      {/* Deal list */}
      <div className="space-y-2">
        {(filteredData ?? []).map(deal => {
          const dealSnap = { id: deal.id, name: deal.name, stage: deal.stage, amount: deal.amount, contractEndDate: deal.contractEndDate };
          const isOpen = expanded.has(deal.id);
          const dealActive = deal.contacts.filter(c => c.tier === 'Active').length;
          const dealInactive = deal.contacts.filter(c => c.tier === 'Inactive').length;
          const dealOpen = Math.max(0, deal.seats - deal.contacts.length);
          return (
            <div key={deal.id} className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
              <button
                onClick={() => toggle(deal.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{deal.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {dealActive} active · {dealInactive} inactive · {dealOpen} open
                  </p>
                </div>
                <span className="text-gray-300 ml-4">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-3 pt-1 border-t border-violet-50">
                  {deal.contacts.length === 0
                    ? <p className="text-xs text-gray-400">No pro users assigned.</p>
                    : <div className="flex flex-wrap gap-1.5">
                        {deal.contacts.map(c => (
                          <ContactChip key={c.id} contact={c} deal={dealSnap} onClick={onContactClick} />
                        ))}
                      </div>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
