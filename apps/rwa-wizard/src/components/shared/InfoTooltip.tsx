import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

interface InfoTooltipProps {
  /** The tooltip body. Keep to 1–2 short sentences so it stays legible. */
  children: ReactNode;
  /** Accessible label for screen readers; defaults to a generic hint. */
  label?: string;
  className?: string;
  /** Side the popup opens from. Defaults to `top`. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Max content width so longer educational copy wraps nicely. */
  maxWidthClassName?: string;
}

/**
 * Small info icon that reveals a short educational blurb on hover / focus.
 *
 * Used throughout the wizard to teach T-REX / ERC-3643 concepts (claim topics,
 * trusted issuers, compliance hooks, …) without polluting the primary copy.
 */
export function InfoTooltip({
  children,
  label = 'More info',
  className,
  side = 'top',
  maxWidthClassName = 'max-w-xs',
}: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
      >
        <Info className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        className={cn(
          'text-xs leading-relaxed',
          maxWidthClassName,
          // renderInlineCopy uses bg-muted + text-foreground on <code>; on this inverted
          // surface (bg-foreground / text-background) that reads as harsh pills. Soften.
          '[&_code]:rounded [&_code]:border [&_code]:border-white/15 [&_code]:!bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:!text-inherit'
        )}
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
