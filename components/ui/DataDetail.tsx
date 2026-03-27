import React from 'react';

interface DataDetailProps {
  children: React.ReactNode;
  className?: string;
}

export default function DataDetail({ children, className = '' }: DataDetailProps) {
  return (
    <div className={`bg-gray-50 rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}
