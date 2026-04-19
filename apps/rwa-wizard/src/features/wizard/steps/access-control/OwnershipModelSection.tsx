import { useCallback, useEffect, useRef } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import type { OwnershipModel } from '@openzeppelin/rwa-config';
import { AddressField, Card, CardContent } from '@openzeppelin/ui-components';

import { useCopy } from '../../../../app/providers/useCopy';
import { useSectionCopy } from '../../../../app/providers/useStepCopy';
import { SectionCardHeader } from '../../../../components/shared/SectionCardHeader';
import { SelectableCard } from '../../../../components/shared/SelectableCard';
import { useAddressing } from '../../../../services/runtime';

interface OwnershipModelSectionProps {
  ownership: OwnershipModel;
  onUpdate: (model: OwnershipModel) => void;
}

const OWNERSHIP_OPTION_TYPES: readonly OwnershipModel['type'][] = [
  'single-owner',
  'multi-sig',
  'dao',
];

interface AddressFormValues {
  ownerAddress: string;
}

export function OwnershipModelSection({ ownership, onUpdate }: OwnershipModelSectionProps) {
  const addressing = useAddressing();
  const copy = useCopy();
  const sectionCopy = useSectionCopy('ownership-model');
  const currentAddress =
    ownership.type === 'single-owner' ? ownership.ownerAddress : ownership.address;

  const isSyncing = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const ownershipRef = useRef(ownership);
  ownershipRef.current = ownership;

  const { control, reset, watch } = useForm<AddressFormValues>({
    defaultValues: { ownerAddress: currentAddress },
    mode: 'onChange',
  });

  useEffect(() => {
    isSyncing.current = true;
    reset({ ownerAddress: currentAddress });
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, [currentAddress, reset]);

  const handleWatch = useCallback((formValues: FieldValues) => {
    if (isSyncing.current) return;
    const value = (formValues.ownerAddress as string) ?? '';
    const current = ownershipRef.current;
    if (current.type === 'single-owner') {
      onUpdateRef.current({ type: 'single-owner', ownerAddress: value });
    } else {
      onUpdateRef.current({ ...current, address: value });
    }
  }, []);

  useEffect(() => {
    const sub = watch(handleWatch);
    return () => sub.unsubscribe();
  }, [watch, handleWatch]);

  const handleModelChange = (type: OwnershipModel['type']) => {
    if (type === 'single-owner') {
      onUpdate({ type, ownerAddress: '' });
    } else {
      onUpdate({ type, address: '' });
    }
  };

  const ownerHelper = copy.fieldHelper(`owner-address.${ownership.type}`);
  const addressLabel = ownerHelper.title ?? 'Owner Address';
  const addressHint = ownerHelper.description;

  return (
    <Card>
      <SectionCardHeader {...sectionCopy} />
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {OWNERSHIP_OPTION_TYPES.map((type) => {
            const entry = copy.ownershipModel(type);
            return (
              <SelectableCard
                key={type}
                title={entry.title ?? ''}
                description={entry.description}
                isSelected={ownership.type === type}
                onClick={() => handleModelChange(type)}
              />
            );
          })}
        </div>

        <AddressField
          id="owner-address"
          name="ownerAddress"
          label={addressLabel}
          placeholder="Enter blockchain address"
          helperText={addressHint}
          control={control}
          addressing={addressing ?? undefined}
        />
      </CardContent>
    </Card>
  );
}
