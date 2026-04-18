import { useCallback } from 'react';

import type { AccessControlConfig, OperatorRole } from '@openzeppelin/rwa-config';
import { Card, CardContent, Label } from '@openzeppelin/ui-components';

import { useSectionCopy } from '../../../app/providers/useStepCopy';
import { AddressListInput } from '../../../components/shared/AddressListInput';
import { SectionCardHeader } from '../../../components/shared/SectionCardHeader';
import { useAddressing, useExplorer } from '../../../services/runtime';
import type { OperatorRoleMeta } from '../../../types/wizard';

interface OperatorRolesSectionProps {
  accessControl: AccessControlConfig;
  documentManagerEnabled: boolean;
  operatorRoles: readonly OperatorRoleMeta[];
  onUpdate: (patch: Partial<AccessControlConfig>) => void;
}

export function OperatorRolesSection({
  accessControl,
  documentManagerEnabled,
  operatorRoles,
  onUpdate,
}: OperatorRolesSectionProps) {
  const addressing = useAddressing();
  const explorer = useExplorer();
  const sectionCopy = useSectionCopy('operator-roles');
  const visibleRoles = operatorRoles.filter(
    (role) => role.id !== 'document-manager' || documentManagerEnabled
  );

  const getAddressesForRole = (roleId: string): string[] => {
    return accessControl.roles.find((r) => r.name === roleId)?.addresses ?? [];
  };

  const handleAddAddress = useCallback(
    (roleDef: OperatorRoleMeta, address: string) => {
      const existing = accessControl.roles.find((r) => r.name === roleDef.id);
      if (existing) {
        if (existing.addresses.includes(address)) return;
        const updatedRoles = accessControl.roles.map((r) =>
          r.name === roleDef.id ? { ...r, addresses: [...r.addresses, address] } : r
        );
        onUpdate({ roles: updatedRoles });
      } else {
        const newRole: OperatorRole = { name: roleDef.id, addresses: [address] };
        onUpdate({ roles: [...accessControl.roles, newRole] });
      }
    },
    [accessControl.roles, onUpdate]
  );

  const handleRemoveAddress = useCallback(
    (roleId: string, addrIndex: number) => {
      const updatedRoles = accessControl.roles
        .map((r) =>
          r.name === roleId ? { ...r, addresses: r.addresses.filter((_, j) => j !== addrIndex) } : r
        )
        .filter((r) => r.addresses.length > 0);
      onUpdate({ roles: updatedRoles });
    },
    [accessControl.roles, onUpdate]
  );

  return (
    <Card>
      <SectionCardHeader {...sectionCopy} />
      <CardContent className="space-y-6">
        {visibleRoles.map((roleDef) => {
          const addresses = getAddressesForRole(roleDef.id);
          return (
            <div key={roleDef.id} className="space-y-2 rounded-lg border border-border p-4">
              <div>
                <Label className="text-base font-medium">{roleDef.name}</Label>
                <p className="text-sm text-muted-foreground">{roleDef.description}</p>
              </div>
              <AddressListInput
                addresses={addresses}
                onAdd={(addr) => handleAddAddress(roleDef, addr)}
                onRemove={(idx) => handleRemoveAddress(roleDef.id, idx)}
                addressing={addressing}
                getExplorerUrl={explorer ? (addr) => explorer.getExplorerUrl(addr) : undefined}
                placeholder="Operator address"
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
