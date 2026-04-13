import { useCallback, useEffect, useRef } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import type { OwnershipModel } from '@openzeppelin/rwa-config';
import {
  AddressField,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@openzeppelin/ui-components';

import { SelectableCard } from '../../../components/shared/SelectableCard';
import { useAddressing } from '../../../services/runtime';

interface OwnershipModelSectionProps {
  ownership: OwnershipModel;
  onUpdate: (model: OwnershipModel) => void;
}

const OWNERSHIP_OPTIONS = [
  {
    type: 'single-owner' as const,
    title: 'Single Owner',
    description: 'One address controls everything',
  },
  {
    type: 'multi-sig' as const,
    title: 'Multi-Sig Owner',
    description: 'Multiple signatures required',
  },
  {
    type: 'dao' as const,
    title: 'DAO Owner',
    description: 'Governance contract',
  },
];

interface AddressFormValues {
  ownerAddress: string;
}

export function OwnershipModelSection({ ownership, onUpdate }: OwnershipModelSectionProps) {
  const addressing = useAddressing();
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

  const addressLabel =
    ownership.type === 'single-owner'
      ? 'Owner Address'
      : ownership.type === 'multi-sig'
        ? 'Multi-Sig Contract Address'
        : 'DAO Contract Address';

  const addressHint =
    ownership.type === 'single-owner'
      ? 'This address will have full control over the token contract'
      : ownership.type === 'multi-sig'
        ? 'Multi-signature wallet address that will control the token contract'
        : 'DAO governance contract address that will control the token contract';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ownership Model</CardTitle>
        <CardDescription>Choose the ownership structure for your token contract.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {OWNERSHIP_OPTIONS.map((option) => (
            <SelectableCard
              key={option.type}
              title={option.title}
              description={option.description}
              isSelected={ownership.type === option.type}
              onClick={() => handleModelChange(option.type)}
            />
          ))}
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
