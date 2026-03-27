import React from 'react';

export interface HeroStat {
  value: string | number;
  label: string;
}

interface HeroSectionProps {
  badge?: string;
  title: string;
  titleAccent?: string;
  subtitle?: string;
  stats?: HeroStat[];
  className?: string;
}

export default function HeroSection({ badge, title, titleAccent, subtitle, stats, className = '' }: HeroSectionProps) {
  return (
    <div
      className={`w-full px-8 py-10 ${className}`}
      style={{ backgroundColor: '#2D034F' }}
    >
      {badge && (
        <span
          className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-4 tracking-wide"
          style={{ backgroundColor: '#FB0467', color: '#ffffff' }}
        >
          {badge}
        </span>
      )}
      <h1 className="text-4xl font-bold leading-tight">
        <span className="text-white">{title}</span>
        {titleAccent && (
          <>
            {' '}
            <span className="text-brand-yellow">{titleAccent}</span>
          </>
        )}
      </h1>
      {subtitle && (
        <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {subtitle}
        </p>
      )}
      {stats && stats.length > 0 && (
        <div className="mt-7 flex items-center gap-8">
          {stats.map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && <div className="w-px h-8 bg-white/20 shrink-0" />}
              <div>
                <div className="text-3xl font-bold text-white leading-none">{stat.value}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {stat.label}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
