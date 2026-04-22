import { Plus, X } from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { AddressDisplay, AddressField, Button, Label } from '@openzeppelin/ui-components';
import type { AddressingCapability } from '@openzeppelin/ui-types';

interface AddressDraftForm {
  address: string;
}

interface AddressListInputProps {
  addresses: string[];
  onAdd: (address: string) => void;
  onRemove: (index: number) => void;
  addressing?: AddressingCapability;
  getExplorerUrl?: (address: string) => string | null;
  placeholder?: string;
  maxItems?: number;
  label?: string;
}

export function AddressListInput({
  addresses,
  onAdd,
  onRemove,
  addressing,
  getExplorerUrl,
  placeholder = 'Operator address',
  maxItems,
  label,
}: AddressListInputProps) {
  const atLimit = maxItems != null && addresses.length >= maxItems;
  const fieldId = useId();

  const { control, handleSubmit, reset, watch } = useForm<AddressDraftForm>({
    defaultValues: { address: '' },
    mode: 'onChange',
  });

  const draftAddress = watch('address');
  const trimmedDraft = draftAddress?.trim() ?? '';

  const isDuplicate = useMemo(() => addresses.includes(trimmedDraft), [addresses, trimmedDraft]);

  // Mirror every constraint that `handleAdd` enforces so the Add button
  // never appears enabled for inputs we would silently reject (e.g. invalid
  // address under the chain adapter). Invalid format is surfaced only by
  // `AddressField`; keep extra copy here to domain rules (e.g. duplicate).
  const isAddressValid = addressing ? addressing.isValidAddress(trimmedDraft) : true;
  const canAdd = !!trimmedDraft && !atLimit && !isDuplicate && isAddressValid;

  const handleAdd = useCallback(
    (data: AddressDraftForm) => {
      const trimmed = data.address.trim();
      if (!trimmed || atLimit || isDuplicate) return;
      if (addressing && !addressing.isValidAddress(trimmed)) return;
      onAdd(trimmed);
      reset({ address: '' });
    },
    [atLimit, isDuplicate, addressing, onAdd, reset]
  );

  const duplicateHint = isDuplicate ? 'Address already added' : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <AddressField
            id={`address-list-${fieldId}`}
            name="address"
            label={label ?? ''}
            placeholder={placeholder}
            helperText={duplicateHint}
            control={control}
            addressing={addressing}
            validation={{ required: false }}
          />
        </div>
        <div className="flex flex-col gap-2">
          {/* Invisible label mirrors the AddressField's label height */}
          <Label className="invisible" aria-hidden="true">
            &nbsp;
          </Label>
          <div className="flex h-10 items-center">
            <Button type="button" onClick={handleSubmit(handleAdd)} size="sm" disabled={!canAdd}>
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </div>
        </div>
      </div>
      {addresses.length > 0 && (
        <div className="space-y-1">
          {addresses.map((address, index) => (
            <div
              key={`${address}-${index}`}
              className="flex items-center justify-between rounded bg-muted p-2"
            >
              <AddressDisplay
                address={address}
                variant="inline"
                truncateWhenLabeled
                showCopyButton
                explorerUrl={getExplorerUrl?.(address) ?? undefined}
              />
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
