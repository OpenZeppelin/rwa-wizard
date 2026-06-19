import { useCallback } from 'react';

import type { AccessControlConfig, OperatorRole } from '@openzeppelin/rwa-config';
import { AddressListField, Card, CardContent, Label } from '@openzeppelin/ui-components';

import { useSectionCopy } from '../../../../app/providers/useStepCopy';
import { SectionCardHeader } from '../../../../components/shared/SectionCardHeader';
import { useAddressListFieldCopy } from '../../../../components/shared/useAddressListFieldCopy';
import { useAddressing, useExplorer } from '../../../../services/runtime';
import type { OperatorRoleMeta } from '../../../../types/wizard';

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
  const addressListCopy = useAddressListFieldCopy();
  const sectionCopy = useSectionCopy('operator-roles');
  const visibleRoles = operatorRoles.filter(
    (role) => role.id !== 'document-manager' || documentManagerEnabled
  );

  const getAddressesForRole = (roleName: string): string[] => {
    return accessControl.roles.find((role) => role.name === roleName)?.addresses ?? [];
  };

  const handleSetRoleAddresses = useCallback(
    (roleDef: OperatorRoleMeta, addresses: string[]) => {
      const otherRoles = accessControl.roles.filter((role) => role.name !== roleDef.name);
      if (addresses.length === 0) {
        onUpdate({ roles: otherRoles });
        return;
      }

      const nextRole: OperatorRole = { name: roleDef.name, addresses };
      onUpdate({ roles: [...otherRoles, nextRole] });
    },
    [accessControl.roles, onUpdate]
  );

  return (
    <Card>
      <SectionCardHeader {...sectionCopy} />
      <CardContent className="space-y-6">
        {visibleRoles.map((roleDef) => {
          const addresses = getAddressesForRole(roleDef.name);
          return (
            <div key={roleDef.id} className="space-y-2 rounded-lg border border-border p-4">
              <div>
                <Label className="text-base font-medium">{roleDef.name}</Label>
                <p className="text-sm text-muted-foreground">{roleDef.description}</p>
              </div>
              <AddressListField
                value={addresses}
                onChange={(next) => handleSetRoleAddresses(roleDef, next)}
                placeholder={addressListCopy.placeholder}
                bulkPlaceholder={addressListCopy.bulkPlaceholder}
                formatHint={addressListCopy.formatHint}
                addressing={addressing}
                getExplorerUrl={explorer ? (addr) => explorer.getExplorerUrl(addr) : undefined}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
