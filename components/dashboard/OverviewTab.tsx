// components/dashboard/OverviewTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { SummaryData, LoginTier, TopAccount } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import SeatTierStat from './SeatTierStat';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? '';

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

function SeatUtilizationBar({ pct, active, total }: { pct: number; active: number; total: number }) {
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Seat Utilization</p>
        <span className="text-sm font-bold text-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-violet-50 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">{active.toLocaleString()} active users of {total.toLocaleString()} total seats</p>
    </div>
  );
}

function RenewalPipelineCard({ pipeline }: { pipeline: SummaryData['renewalPipeline'] }) {
  const buckets = [
    { label: '30 days', count: pipeline.d30.count, amount: pipeline.d30.amount },
    { label: '60 days', count: pipeline.d60.count, amount: pipeline.d60.amount },
    { label: '90 days', count: pipeline.d90.count, amount: pipeline.d90.amount },
  ];
  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">Renewal Pipeline</p>
      <div className="grid grid-cols-3 divide-x divide-violet-100">
        {buckets.map(b => (
          <div key={b.label} className="px-3 first:pl-0 last:pr-0">
            <p className="text-xs text-gray-400">{b.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">${b.amount.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{b.count} deal{b.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RenewalsByMonthCard({ months }: { months: SummaryData['renewalsByMonth'] }) {
  const max = Math.max(...months.map(m => m.amount), 1);
  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">Upcoming Renewals</p>
      <div className="grid grid-cols-3 gap-3">
        {months.map(m => (
          <div key={m.label} className="space-y-1.5">
            <p className="text-xs font-medium text-gray-600">{m.label}</p>
            <div className="h-1.5 rounded-full bg-violet-50">
              <div className="h-1.5 rounded-full bg-brand-purple" style={{ width: `${(m.amount / max) * 100}%` }} />
            </div>
            <p className="text-sm font-bold text-foreground">${m.amount.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{m.count} deal{m.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuoteCoverageCard({ coverage }: { coverage: SummaryData['quoteCoverage'] }) {
  const pct = coverage.total > 0 ? Math.round((coverage.withQuote / coverage.total) * 100) : 0;
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Quote Coverage</p>
        <span className="text-sm font-bold text-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-violet-50 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        {coverage.withQuote} of {coverage.total} deals renewing in 90d have a quote
      </p>
    </div>
  );
}

function TopAccountsCard({ accounts }: { accounts: TopAccount[] }) {
  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">Top 10 Accounts by ARR</p>
      <div className="space-y-1">
        {accounts.map((a, i) => {
          const renewDate = a.contractEndDate
            ? new Date(a.contractEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
            : '—';
          return (
            <div key={a.id} className="flex items-center gap-3 py-1.5 border-b border-violet-50 last:border-0">
              <span className="text-xs text-gray-300 w-4 shrink-0 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <a
                  href={`https://app.hubspot.com/contacts/${PORTAL_ID}/deal/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-foreground hover:text-violet-700 transition-colors truncate block"
                >
                  {a.name}
                </a>
                <p className="text-xs text-gray-400">{a.stage} · renews {renewDate}</p>
              </div>
              <span className="text-xs font-semibold text-foreground shrink-0">
                ${a.amount.toLocaleString()}
              </span>
            </div>
          );
        })}
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

      {/* Top stats */}
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

      {/* Seat utilization */}
      <SeatUtilizationBar
        pct={data.seatUtilizationPct}
        active={data.activeContacts}
        total={data.totalSeats}
      />

      {/* Seat tier breakdown */}
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

      {/* Renewal pipeline */}
      {data.renewalPipeline && <RenewalPipelineCard pipeline={data.renewalPipeline} />}

      {/* Upcoming by month + quote coverage */}
      {(data.renewalsByMonth || data.quoteCoverage) && (
        <div className="grid grid-cols-2 gap-3">
          {data.renewalsByMonth && <RenewalsByMonthCard months={data.renewalsByMonth} />}
          {data.quoteCoverage && <QuoteCoverageCard coverage={data.quoteCoverage} />}
        </div>
      )}

      {/* Top accounts */}
      {data.topAccounts?.length > 0 && <TopAccountsCard accounts={data.topAccounts} />}

      {/* Distributions */}
      <div className="grid grid-cols-2 gap-3">
        <DistributionTile title="By Deal Stage" counts={data.byStage} />
        <DistributionTile title="By Business Type" counts={data.byBusinessType} />
      </div>
    </div>
  );
}
