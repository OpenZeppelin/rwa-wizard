import type { ReactNode } from 'react';

import { cn } from '@openzeppelin/ui-utils';

interface SelectableCardProps {
  title: string;
  description?: string;
  isSelected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
  className?: string;
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
}: SelectableCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span className="inline-flex items-center gap-1.5 font-medium">
          {title}
          {icon && <span className="inline-flex items-center text-muted-foreground">{icon}</span>}
        </span>
        {description && <span className="mt-0.5 text-sm text-muted-foreground">{description}</span>}
      </div>
      {badge && <div className="flex-shrink-0">{badge}</div>}
    </button>
  );
}
