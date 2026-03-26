import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="flex items-stretch gap-3 mb-6">
      <div className="w-1 rounded self-stretch bg-deep-violet shrink-0" />
      <div>
        <h1 className="text-2xl font-bold text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
