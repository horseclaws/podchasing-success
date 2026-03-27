import React from 'react';

export interface Stat {
  label: string;
  value: string | number;
  subtext?: string;
}

interface StatGridProps {
  stats: Stat[];
}

export default function StatGrid({ stats }: StatGridProps) {
  return (
    <div className="flex items-center divide-x divide-gray-200">
      {stats.map((stat, i) => (
        <div key={i} className="flex flex-col items-center px-8 first:pl-0 last:pr-0">
          <span className="text-4xl font-bold text-foreground leading-none">{stat.value}</span>
          <span className="mt-1 text-sm font-semibold text-gray-500 uppercase tracking-wide">{stat.label}</span>
          {stat.subtext && (
            <span className="mt-0.5 text-xs text-gray-400">{stat.subtext}</span>
          )}
        </div>
      ))}
    </div>
  );
}
