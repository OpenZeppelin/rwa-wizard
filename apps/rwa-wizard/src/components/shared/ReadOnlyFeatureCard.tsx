import { Info, Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@openzeppelin/ui-utils';

import { Badge } from './Badge';

interface ReadOnlyFeatureCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  enabled?: boolean;
  className?: string;
}

export function ReadOnlyFeatureCard({
  title,
  description,
  icon,
  enabled = true,
  className,
}: ReadOnlyFeatureCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border border-border p-4',
        className
      )}
    >
      <div>
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          {title}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            {icon ?? <Lock className="size-3.5" />}
            <Info className="size-3.5" />
          </span>
        </p>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <Badge variant={enabled ? 'success-text' : 'outline'}>
        {enabled ? 'Enabled' : 'Disabled'}
      </Badge>
    </div>
  );
}
