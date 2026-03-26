'use client';
import { useEffect, useState } from 'react';
import type { ChorusInsightsData } from '@/lib/chorus';
import InsightCard from '@/components/ui/InsightCard';

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
      <InsightCard>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Call Insights</h3>
        <p className="text-xs text-gray-400">Loading call insights…</p>
      </InsightCard>
    );
  }

  if (insights === null) {
    return (
      <InsightCard>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Call Insights</h3>
        <p className="text-xs text-gray-400">No Chorus calls found for this account.</p>
      </InsightCard>
    );
  }

  const dateLabel = insights.latestCallDate
    ? new Date(insights.latestCallDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'unknown date';

  const sections: { label: string; items: string[]; colorClass: string; dotClass: string }[] = [
    { label: 'Usage signals',  items: insights.usage,        colorClass: 'text-brand-cyan',  dotClass: 'text-brand-cyan'  },
    { label: 'Frustrations',   items: insights.frustrations, colorClass: 'text-brand-pink',  dotClass: 'text-brand-pink'  },
    { label: 'Goals',          items: insights.goals,        colorClass: 'text-brand-mint',  dotClass: 'text-brand-mint'  },
  ];

  return (
    <InsightCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Call Insights</h3>
        <span className="text-xs text-gray-400">{insights.callCount} call{insights.callCount !== 1 ? 's' : ''} · latest {dateLabel}</span>
      </div>
      <div className="space-y-4">
        {sections.filter(s => s.items.length > 0).map(s => (
          <div key={s.label}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${s.colorClass}`}>{s.label}</p>
            <ul className="space-y-1">
              {s.items.map((item, i) => (
                <li key={i} className="text-xs flex gap-2 text-gray-700">
                  <span className={`shrink-0 mt-0.5 ${s.dotClass}`}>·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}
