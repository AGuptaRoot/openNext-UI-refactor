import React from 'react';
import { sampleUrgencyDotClass } from '../../types/samples';

export function SampleUrgencyDot({
  urgency,
  className = '',
}: {
  urgency: string;
  className?: string;
}): React.ReactElement {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${sampleUrgencyDotClass(urgency)} ${className}`}
      aria-hidden
    />
  );
}
