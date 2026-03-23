'use client';
import { useEffect, useState } from 'react';

interface ChorusInsightsData {
  usage: string[];
  frustrations: string[];
  goals: string[];
  callCount: number;
  latestCallDate: string;
}

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
      <div className="border border-gray-200 rounded p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Call Insights</h3>
        <p className="text-xs text-gray-400">Loading call insights…</p>
      </div>
    );
  }

  if (insights === null) {
    return (
      <div className="border border-gray-200 rounded p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Call Insights</h3>
        <p className="text-xs text-gray-400">No Chorus calls found for this account.</p>
      </div>
    );
  }

  const sections: { label: string; items: string[]; color: string }[] = [
    { label: 'Usage signals', items: insights.usage, color: 'text-blue-700' },
    { label: 'Frustrations', items: insights.frustrations, color: 'text-red-600' },
    { label: 'Goals', items: insights.goals, color: 'text-green-700' },
  ];

  return (
    <div className="border border-gray-200 rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Call Insights</h3>
        <span className="text-xs text-gray-400">{insights.callCount} call{insights.callCount !== 1 ? 's' : ''} · latest {new Date(insights.latestCallDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div className="space-y-3">
        {sections.filter(s => s.items.length > 0).map(s => (
          <div key={s.label}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${s.color}`}>{s.label}</p>
            <ul className="space-y-0.5">
              {s.items.map((item, i) => (
                <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                  <span className="text-gray-400 shrink-0">·</span>
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
