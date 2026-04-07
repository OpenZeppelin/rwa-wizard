import { Plus, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button, Input } from '@openzeppelin/ui-components';
import type { AddressingCapability } from '@openzeppelin/ui-types';
import { cn } from '@openzeppelin/ui-utils';

interface AddressListInputProps {
  addresses: string[];
  onAdd: (address: string) => void;
  onRemove: (index: number) => void;
  addressing?: AddressingCapability;
  placeholder?: string;
  maxItems?: number;
  label?: string;
}

export function AddressListInput({
  addresses,
  onAdd,
  onRemove,
  addressing,
  placeholder = 'Operator address',
  maxItems,
  label,
}: AddressListInputProps) {
  const [draft, setDraft] = useState('');
  const [touched, setTouched] = useState(false);
  const atLimit = maxItems != null && addresses.length >= maxItems;

  const validationError = useMemo(() => {
    if (!touched || !draft.trim()) return undefined;
    if (addressing && !addressing.isValidAddress(draft.trim())) {
      return 'Invalid address format for the selected chain';
    }
    if (addresses.includes(draft.trim())) {
      return 'Address already added';
    }
    return undefined;
  }, [touched, draft, addressing, addresses]);

  const canAdd = draft.trim() && !atLimit && !validationError;

  const handleAdd = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || atLimit) return;
    if (addressing && !addressing.isValidAddress(trimmed)) return;
    if (addresses.includes(trimmed)) return;
    onAdd(trimmed);
    setDraft('');
    setTouched(false);
  }, [draft, atLimit, addressing, addresses, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <div className="space-y-2">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!touched) setTouched(true);
          }}
          onKeyDown={handleKeyDown}
          disabled={atLimit}
          className={cn(
            'flex-1',
            validationError && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        <Button type="button" onClick={handleAdd} size="sm" disabled={!canAdd}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </div>
      {validationError && <p className="text-xs text-destructive">{validationError}</p>}
      {addresses.length > 0 && (
        <div className="space-y-1">
          {addresses.map((address, index) => (
            <div key={index} className="flex items-center justify-between rounded bg-muted p-2">
              <span className="truncate font-mono text-sm">{address}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(index)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
