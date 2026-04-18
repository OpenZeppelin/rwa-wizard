import type { ReactNode } from 'react';

import { cn } from '@openzeppelin/ui-utils';

import { InfoTooltip } from './InfoTooltip';

interface WizardFrameProps {
  title: string;
  description?: string;
  /**
   * Longer educational copy revealed on hover / focus of an info icon next to
   * the step title. Use for T-REX / ERC-3643 context that would otherwise
   * bloat the step heading.
   */
  descriptionTooltip?: ReactNode;
  children: ReactNode;
  /** Vertical gap between top-level sections. Defaults to `space-y-6`. */
  spacing?: 'space-y-6' | 'space-y-8';
  className?: string;
}

/**
 * Top-level layout wrapper for a wizard step. Renders a page-level
 * heading (h2) with an optional subtitle (and an optional info-icon
 * tooltip for deeper educational copy), followed by the step's
 * sections using consistent vertical spacing.
 */
export function WizardFrame({
  title,
  description,
  descriptionTooltip,
  children,
  spacing = 'space-y-6',
  className,
}: WizardFrameProps) {
  return (
    <div className={cn(spacing, className)}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
          {descriptionTooltip && (
            <InfoTooltip label={`About ${title}`} maxWidthClassName="max-w-md">
              {descriptionTooltip}
            </InfoTooltip>
          )}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
