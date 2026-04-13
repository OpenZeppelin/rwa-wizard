import type { ReactNode } from 'react';

import { cn } from '@openzeppelin/ui-utils';

interface WizardSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Vertical spacing between child elements. Defaults to `space-y-4`. */
  spacing?: 'space-y-2' | 'space-y-4' | 'space-y-6';
  className?: string;
}

/**
 * Reusable section within a wizard step. Provides a consistent header
 * (title + optional description) followed by vertically spaced content.
 */
export function WizardSection({
  title,
  description,
  children,
  spacing = 'space-y-4',
  className,
}: WizardSectionProps) {
  return (
    <section className={cn(spacing, className)}>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
