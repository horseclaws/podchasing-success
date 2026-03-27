import React from 'react';

interface InsightCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function InsightCard({ title, children, className = '' }: InsightCardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
      {title && (
        <h3 className="text-base font-bold text-foreground mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}
