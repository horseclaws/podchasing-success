'use client';
import { useEffect, useState } from 'react';
import type { ChorusInsightsData } from '@/lib/chorus';

interface Props {
  companyName: string;
}

export default function ChorusInsights({ companyName }: Props) {
  const [insights, setInsights] = useState<ChorusInsightsData | null | undefined>(undefined);

  useEffect(() => {
    if (!companyName) return;
    const encoded = encodeURIComponent(companyName);
    fetch(`/api/chorus?company=${encoded}`)
      .then(r => {
        if (!r.ok) { setInsights(null); return; }
        return r.json();
      })
      .then(data => {
        if (data !== undefined) setInsights(data.insights ?? null);
      })
      .catch(() => setInsights(null));
  }, [companyName]);

  if (insights === undefined) {
    return (
      <div className="rounded-2xl p-5" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A027D' }}>Call Insights</h3>
        <p className="text-xs" style={{ color: '#9ca3af' }}>Loading call insights…</p>
      </div>
    );
  }

  if (insights === null) {
    return (
      <div className="rounded-2xl p-5" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A027D' }}>Call Insights</h3>
        <p className="text-xs" style={{ color: '#9ca3af' }}>No Chorus calls found for this account.</p>
      </div>
    );
  }

  const dateLabel = insights.latestCallDate
    ? new Date(insights.latestCallDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'unknown date';

  const sections: { label: string; items: string[]; color: string }[] = [
    { label: 'Usage signals', items: insights.usage, color: '#0DAAC9' },
    { label: 'Frustrations', items: insights.frustrations, color: '#FB0467' },
    { label: 'Goals', items: insights.goals, color: '#2BDA9F' },
  ];

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 12px rgba(74,2,125,0.06)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A027D' }}>Call Insights</h3>
        <span className="text-xs" style={{ color: '#9ca3af' }}>{insights.callCount} call{insights.callCount !== 1 ? 's' : ''} · latest {dateLabel}</span>
      </div>
      <div className="space-y-4">
        {sections.filter(s => s.items.length > 0).map(s => (
          <div key={s.label}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: s.color }}>{s.label}</p>
            <ul className="space-y-1">
              {s.items.map((item, i) => (
                <li key={i} className="text-xs flex gap-2" style={{ color: '#374151' }}>
                  <span className="shrink-0 mt-0.5" style={{ color: s.color }}>·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
