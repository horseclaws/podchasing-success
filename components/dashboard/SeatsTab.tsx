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
  const [tierFilter, setTierFilter] = useState<LoginTier[] | null>(
    initialTierFilter ? [initialTierFilter] : null
  );
  const [openSeatsFilter, setOpenSeatsFilter] = useState(false);
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

  const toggleTier = (tier: LoginTier) =>
    setTierFilter(prev => {
      if (!prev) return [tier];
      const has = prev.includes(tier);
      const next = has ? prev.filter(t => t !== tier) : [...prev, tier];
      return next.length === 0 ? null : next;
    });

  const clearFilters = () => { setTierFilter(null); setOpenSeatsFilter(false); };
  const anyFilterActive = tierFilter !== null || openSeatsFilter;

  const allContacts = data?.flatMap(d => d.contacts) ?? [];
  const active = allContacts.filter(c => c.tier === 'Active').length;
  const inactive = allContacts.filter(c => c.tier === 'Inactive').length;
  const ghost = allContacts.filter(c => c.tier === 'Ghost').length;
  const totalSeats = data?.reduce((s, d) => s + d.seats, 0) ?? 0;
  const totalAssigned = allContacts.length;
  const openSeats = Math.max(0, totalSeats - totalAssigned);
  const inactivePro = inactive + ghost;
  const utilizationPct = totalSeats > 0 ? Math.round((active / totalSeats) * 100) : 0;

  // Per-deal stats using unfiltered data (for accurate utilization regardless of active filter)
  const dealStatsMap = new Map((data ?? []).map(d => {
    const dActive = d.contacts.filter(c => c.tier === 'Active').length;
    const dInactive = d.contacts.filter(c => c.tier === 'Inactive').length;
    const dOpen = Math.max(0, d.seats - d.contacts.length);
    const dUtil = d.seats > 0 ? Math.round((dActive / d.seats) * 100) : 0;
    return [d.id, { active: dActive, inactive: dInactive, open: dOpen, util: dUtil }];
  }));

  const filteredData = (data ?? []).map(d => {
    let contacts = d.contacts;
    if (tierFilter) contacts = contacts.filter(c => tierFilter.includes(c.tier));
    return { ...d, contacts };
  }).filter(d => {
    if (openSeatsFilter && d.seats <= d.contacts.length) return false;
    if (tierFilter && d.contacts.length === 0) return false;
    return true;
  });

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
      {(() => {
        const topStats = [
          { label: 'Total Seats', value: totalSeats, sub: `${utilizationPct}% active`, isActive: false, onClick: clearFilters },
          { label: 'Assigned', value: totalAssigned, sub: undefined, isActive: false, onClick: clearFilters },
          {
            label: 'Open Seats',
            value: openSeats,
            sub: undefined,
            isActive: openSeatsFilter,
            onClick: () => { setOpenSeatsFilter(prev => !prev); setTierFilter(null); },
          },
          {
            label: 'Inactive Pro Users',
            value: inactivePro,
            sub: undefined,
            isActive: !!(tierFilter && tierFilter.includes('Inactive') && tierFilter.includes('Ghost') && tierFilter.length === 2 && !openSeatsFilter),
            onClick: () => {
              setOpenSeatsFilter(false);
              setTierFilter(prev =>
                prev && prev.length === 2 && prev.includes('Inactive') && prev.includes('Ghost') ? null : ['Inactive', 'Ghost']
              );
            },
          },
        ];
        return (
          <div className="grid grid-cols-4 gap-3">
            {topStats.map(s => (
              <button
                key={s.label}
                onClick={s.onClick}
                className={`rounded-2xl p-4 text-left transition-all ${
                  s.isActive
                    ? 'bg-brand-purple border border-brand-purple ring-2 ring-brand-purple/30'
                    : 'bg-white border border-violet-100 hover:border-brand-purple/40 hover:shadow-sm'
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wide ${s.isActive ? 'text-white/80' : 'text-brand-purple'}`}>
                  {s.label}
                </p>
                <p className={`text-2xl font-bold mt-1 ${s.isActive ? 'text-white' : 'text-foreground'}`}>{s.value}</p>
                {s.sub && <p className={`text-xs mt-0.5 ${s.isActive ? 'text-white/60' : 'text-gray-400'}`}>{s.sub}</p>}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Tier filter */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 flex-1">
          {(['Active', 'Inactive', 'Ghost'] as LoginTier[]).map(tier => (
            <SeatTierStat
              key={tier}
              tier={tier}
              count={tier === 'Active' ? active : tier === 'Inactive' ? inactive : ghost}
              onClick={t => { setOpenSeatsFilter(false); toggleTier(t); }}
            />
          ))}
        </div>
        {anyFilterActive && (
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-brand-purple whitespace-nowrap">
            Clear filter
          </button>
        )}
      </div>

      {/* Deal list */}
      <div className="space-y-2">
        {filteredData.length === 0 ? (
          anyFilterActive ? (
            <div className="rounded-2xl border border-violet-100 bg-violet-50 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-brand-purple">No deals match this filter.</p>
              <button onClick={clearFilters} className="text-xs text-brand-purple/60 hover:text-brand-purple mt-1">
                Clear filter
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-violet-100 bg-violet-50 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-brand-purple">No active deals found.</p>
            </div>
          )
        ) : filteredData.map(deal => {
          const dealSnap = { id: deal.id, name: deal.name, stage: deal.stage, amount: deal.amount, contractEndDate: deal.contractEndDate };
          const isOpen = expanded.has(deal.id);
          const stats = dealStatsMap.get(deal.id) ?? { active: 0, inactive: 0, open: 0, util: 0 };
          const utilColor = stats.util >= 70 ? 'bg-emerald-400' : stats.util >= 40 ? 'bg-amber-400' : 'bg-red-400';
          return (
            <div key={deal.id} className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
              <button
                onClick={() => toggle(deal.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-50 transition-colors"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium text-foreground">{deal.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {deal.seats} seats · {stats.active} active · {stats.inactive} inactive · {stats.open} open
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-1 rounded-full bg-violet-50 flex-1 overflow-hidden">
                      <div className={`h-1 rounded-full ${utilColor}`} style={{ width: `${stats.util}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{stats.util}% active</span>
                  </div>
                </div>
                <span className="text-gray-300 shrink-0">{isOpen ? '▲' : '▼'}</span>
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
