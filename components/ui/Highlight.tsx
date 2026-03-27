import React from 'react';

interface HighlightProps {
  children: React.ReactNode;
}

/** Wraps inline keyword text in brand-magenta bold. */
export default function Highlight({ children }: HighlightProps) {
  return (
    <strong style={{ color: '#FF007A' }}>{children}</strong>
  );
}
