import { Check, X } from 'lucide-react';

import { cn } from '@openzeppelin/ui-utils';

interface TogglePillProps {
  label: string;
  detail?: string | number;
  selected: boolean;
  onClick: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
}

export function TogglePill({
  label,
  detail,
  selected,
  onClick,
  onRemove,
  disabled,
  className,
}: TogglePillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border text-xs font-medium transition-colors',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-dashed border-border text-muted-foreground hover:bg-muted',
        disabled && 'opacity-50',
        className
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 py-1 pl-2.5',
          onRemove ? 'pr-1' : 'pr-2.5',
          disabled && 'cursor-not-allowed'
        )}
      >
        {selected && <Check className="size-3" />}
        {label}
        {detail != null && <span className="font-normal opacity-40">id:{detail}</span>}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex cursor-pointer items-center justify-center pr-1.5 hover:text-destructive"
          aria-label={`Remove ${label}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
