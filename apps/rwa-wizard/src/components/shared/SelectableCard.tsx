import type { ReactNode } from 'react';
import { useId } from 'react';

import { cn } from '@openzeppelin/ui-utils';

import type { ConfigAnchorKey } from '../../features/wizard/focused-path';
import { useIsInspected } from '../../features/wizard/inspected-anchor';

interface SelectableCardProps {
  title: string;
  description?: string;
  isSelected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
  className?: string;
  /**
   * Config location this card edits, for focused-path resolution. Renders as
   * one `data-*` attribute on the button that already existed: nothing visual,
   * nothing measurable, nothing announced. Omitted entirely when absent — an
   * empty value would still match `closest('[data-config-anchor]')` and would
   * claim everything beneath it as its own. INV-8.
   */
  configAnchor?: ConfigAnchorKey;
}

export function SelectableCard({
  title,
  description,
  isSelected,
  onClick,
  icon,
  disabled,
  badge,
  className,
  configAnchor,
}: SelectableCardProps) {
  const inspected = useIsInspected(configAnchor);
  const descriptionId = useId();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-config-anchor={configAnchor}
      aria-current={inspected ? 'true' : undefined}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
        disabled && 'cursor-not-allowed opacity-50',
        inspected && 'ring-1 ring-primary ring-offset-1 ring-offset-background',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span className="inline-flex items-center gap-1.5 font-medium">
          {title}
          {icon && <span className="inline-flex items-center text-muted-foreground">{icon}</span>}
        </span>
        {description && (
          <span id={descriptionId} className="mt-0.5 text-sm text-muted-foreground">
            {description}
          </span>
        )}
      </div>
      {badge && <div className="flex-shrink-0">{badge}</div>}
    </button>
  );
}
