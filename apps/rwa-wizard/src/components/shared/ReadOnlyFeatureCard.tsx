import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@openzeppelin/ui-utils';

import { Badge } from './Badge';
import { InfoTooltip } from './InfoTooltip';

interface ReadOnlyFeatureCardProps {
  title: string;
  description?: string;
  /**
   * Content shown when the user hovers / focuses the info icon next to the
   * title. The icon is only rendered when this is provided — we never fall
   * back to `description` to avoid a tooltip that just duplicates the
   * visible line underneath.
   */
  infoTooltip?: ReactNode;
  /** Overrides the default lock glyph rendered next to the title. */
  icon?: ReactNode;
  enabled?: boolean;
  className?: string;
}

export function ReadOnlyFeatureCard({
  title,
  description,
  infoTooltip,
  icon,
  enabled = true,
  className,
}: ReadOnlyFeatureCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border border-border p-4',
        className
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          {title}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            {icon ?? <Lock className="size-3.5" />}
            {infoTooltip && (
              <InfoTooltip label={`About ${title}`} maxWidthClassName="max-w-sm">
                {infoTooltip}
              </InfoTooltip>
            )}
          </span>
        </p>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <Badge variant={enabled ? 'success' : 'outline'} className="shrink-0">
        {enabled ? 'Enabled' : 'Disabled'}
      </Badge>
    </div>
  );
}
