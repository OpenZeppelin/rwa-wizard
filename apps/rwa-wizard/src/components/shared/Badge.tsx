import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@openzeppelin/ui-utils';

type BadgeVariant =
  | 'default'
  | 'outline'
  | 'secondary'
  | 'destructive'
  | 'success'
  | 'success-text';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  onRemove?: () => void;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-primary text-primary-foreground',
  outline: 'border border-border text-foreground bg-background',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  success: 'bg-green-100 text-green-700',
  'success-text': 'text-sm font-medium text-green-600',
};

export function Badge({ children, variant = 'default', className, onRemove }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 inline-flex size-3.5 cursor-pointer items-center justify-center rounded-full hover:bg-black/10"
          aria-label="Remove"
        >
          <X className="size-2.5" />
        </button>
      )}
    </span>
  );
}
