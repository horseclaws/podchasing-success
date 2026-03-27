import React from 'react';

type BadgeVariant = 'default' | 'magenta' | 'yellow' | 'green' | 'violet' | 'gray';

const variantStyles: Record<BadgeVariant, string> = {
  default:  'bg-gray-100 text-gray-700',
  magenta:  'bg-pink-100 text-pink-700',
  yellow:   'bg-yellow-100 text-yellow-700',
  green:    'bg-emerald-100 text-emerald-700',
  violet:   'bg-violet-100 text-violet-800',
  gray:     'bg-gray-200 text-gray-600',
};

interface PillBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export default function PillBadge({ label, variant = 'default', className = '' }: PillBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${variantStyles[variant]} ${className}`}
    >
      {label}
    </span>
  );
}
