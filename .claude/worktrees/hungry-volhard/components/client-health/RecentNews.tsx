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
      <div className="border border-gray-200 rounded p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Recent News</h3>
        <p className="text-xs text-gray-400">Loading recent news…</p>
      </div>
    );
  }

  if (articles === null) {
    return (
      <div className="border border-gray-200 rounded p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Recent News</h3>
        <p className="text-xs text-gray-400">No recent news found for this company.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent News</h3>
      <ul className="space-y-4">
        {articles.map((article, i) => (
          <li key={i}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {article.title}
            </a>
            <p className="text-xs text-gray-400 mt-0.5">
              {article.source}{article.date ? ` · ${article.date}` : ''}
            </p>
            {article.relevance && (
              <p className="text-xs text-gray-500 italic mt-0.5">{article.relevance}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
