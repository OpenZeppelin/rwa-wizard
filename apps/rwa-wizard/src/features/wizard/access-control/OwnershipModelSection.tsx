import type { OwnershipModel } from '@openzeppelin/rwa-config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@openzeppelin/ui-components';

import { SelectableCard } from '../../../components/shared/SelectableCard';
import { ValidatedAddressInput } from '../../../components/shared/ValidatedAddressInput';
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

export function OwnershipModelSection({ ownership, onUpdate }: OwnershipModelSectionProps) {
  const addressing = useAddressing();
  const currentAddress =
    ownership.type === 'single-owner' ? ownership.ownerAddress : ownership.address;

  const handleModelChange = (type: OwnershipModel['type']) => {
    if (type === 'single-owner') {
      onUpdate({ type, ownerAddress: '' });
    } else {
      onUpdate({ type, address: '' });
    }
  };

  const handleAddressChange = (value: string) => {
    if (ownership.type === 'single-owner') {
      onUpdate({ type: 'single-owner', ownerAddress: value });
    } else {
      onUpdate({ ...ownership, address: value });
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

        <ValidatedAddressInput
          id="owner-address"
          label={addressLabel}
          value={currentAddress}
          onChange={handleAddressChange}
          addressing={addressing}
          placeholder="Enter blockchain address"
          helperText={addressHint}
        />
      </CardContent>
    </Card>
  );
}
