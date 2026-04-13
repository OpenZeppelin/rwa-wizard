import type { ReactNode } from 'react';

import { cn } from '@openzeppelin/ui-utils';

interface WizardFrameProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Vertical gap between top-level sections. Defaults to `space-y-6`. */
  spacing?: 'space-y-6' | 'space-y-8';
  className?: string;
}

/**
 * Top-level layout wrapper for a wizard step. Renders a page-level
 * heading (h2) with an optional subtitle, followed by the step's
 * sections using consistent vertical spacing.
 */
export function WizardFrame({
  title,
  description,
  children,
  spacing = 'space-y-6',
  className,
}: WizardFrameProps) {
  return (
    <div className={cn(spacing, className)}>
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
