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
        'flex cursor-pointer flex-col items-start rounded-lg border-2 p-4 text-left transition-colors',
        isSelected ? 'border-blue-600 bg-blue-50' : 'border-zinc-200 hover:border-blue-300',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {icon && <div className="mb-2">{icon}</div>}
      <div className="flex w-full items-center justify-between gap-2">
        <span className="mb-1 font-medium">{title}</span>
        {badge}
      </div>
      {description && <span className="text-sm text-muted-foreground">{description}</span>}
    </button>
  );
}
