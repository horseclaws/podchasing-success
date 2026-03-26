'use client';
import { useEffect, useState } from 'react';
import type { NewsArticle } from '@/lib/serper';
import InsightCard from '@/components/ui/InsightCard';

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
      <InsightCard>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Recent News</h3>
        <p className="text-xs text-gray-400">Loading recent news…</p>
      </InsightCard>
    );
  }

  if (articles === null) {
    return (
      <InsightCard>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Recent News</h3>
        <p className="text-xs text-gray-400">No recent news found for this company.</p>
      </InsightCard>
    );
  }

  return (
    <InsightCard>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-4 text-brand-purple">Recent News</h3>
      <ul className="space-y-4">
        {articles.map((article, i) => (
          <li key={i}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-cyan hover:underline"
            >
              {article.title}
            </a>
            <p className="text-xs mt-0.5 text-gray-400">
              {article.source}{article.date ? ` · ${article.date}` : ''}
            </p>
            {article.relevance && (
              <p className="text-xs italic mt-1 text-gray-500">{article.relevance}</p>
            )}
          </li>
        ))}
      </ul>
    </InsightCard>
  );
}
