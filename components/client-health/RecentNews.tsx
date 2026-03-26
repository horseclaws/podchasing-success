'use client';
import { useEffect, useState } from 'react';
import type { NewsArticle } from '@/lib/serper';

interface Props {
  companyName: string;
}

export default function RecentNews({ companyName }: Props) {
  const [articles, setArticles] = useState<NewsArticle[] | null | undefined>(undefined);

  useEffect(() => {
    if (!companyName) return;
    fetch(`/api/news?company=${encodeURIComponent(companyName)}`)
      .then(r => {
        if (!r.ok) { setArticles(null); return; }
        return r.json();
      })
      .then(data => {
        if (data !== undefined) setArticles(data.articles ?? null);
      })
      .catch(() => setArticles(null));
  }, [companyName]);

  if (articles === undefined) {
    return (
      <div className="rounded-2xl p-5" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A027D' }}>Recent News</h3>
        <p className="text-xs" style={{ color: '#9ca3af' }}>Loading recent news…</p>
      </div>
    );
  }

  if (articles === null) {
    return (
      <div className="rounded-2xl p-5" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A027D' }}>Recent News</h3>
        <p className="text-xs" style={{ color: '#9ca3af' }}>No recent news found for this company.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 12px rgba(74,2,125,0.06)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#4A027D' }}>Recent News</h3>
      <ul className="space-y-4">
        {articles.map((article, i) => (
          <li key={i}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline"
              style={{ color: '#0DAAC9' }}
            >
              {article.title}
            </a>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              {article.source}{article.date ? ` · ${article.date}` : ''}
            </p>
            {article.relevance && (
              <p className="text-xs italic mt-1" style={{ color: '#6b7280' }}>{article.relevance}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
