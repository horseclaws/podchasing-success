import React from 'react';

interface HeroSummaryProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function HeroSummary({ title, subtitle, children, className = '' }: HeroSummaryProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl px-8 py-10 ${className}`}
      style={{ backgroundColor: '#2D034F' }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10">
        <h2 className="text-3xl font-bold text-white leading-tight">{title}</h2>
        {subtitle && (
          <p className="mt-2 text-purple-200 text-sm">{subtitle}</p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
