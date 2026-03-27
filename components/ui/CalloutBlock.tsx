import React from 'react';

interface CalloutBlockProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function CalloutBlock({ title, children, className = '' }: CalloutBlockProps) {
  return (
    <div
      className={`bg-gray-900 rounded-xl pl-5 pr-6 py-5 border-l-4 ${className}`}
      style={{ borderLeftColor: '#FF007A' }}
    >
      {title && (
        <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-3">{title}</h4>
      )}
      <div className="text-gray-300 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
