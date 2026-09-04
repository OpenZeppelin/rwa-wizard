import { useCallback } from 'react';

import type { AccessControlConfig, OperatorRole } from '@openzeppelin/rwa-config';
import { AddressListField, Card, CardContent, Label } from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

import { useSectionCopy } from '../../../../app/providers/useStepCopy';
import { SectionCardHeader } from '../../../../components/shared/SectionCardHeader';
import { useAddressListFieldCopy } from '../../../../components/shared/useAddressListFieldCopy';
import { useAddressing, useExplorer } from '../../../../services/runtime';
import type { OperatorRoleMeta } from '../../../../types/wizard';
import { roleAnchor } from '../../focused-path';
import { useIsInspected } from '../../inspected-anchor';

interface OperatorRolesSectionProps {
  accessControl: AccessControlConfig;
  documentManagerEnabled: boolean;
  operatorRoles: readonly OperatorRoleMeta[];
  onUpdate: (patch: Partial<AccessControlConfig>) => void;
}

function OperatorRoleRow(props: {
  readonly roleDef: OperatorRoleMeta;
  readonly addresses: readonly string[];
  readonly onSetAddresses: (addresses: string[]) => void;
  readonly placeholder: string;
  readonly bulkPlaceholder: string;
  readonly formatHint: string;
  readonly addressing: ReturnType<typeof useAddressing>;
  readonly getExplorerUrl: ((address: string) => string | undefined) | undefined;
}) {
  const {
    roleDef,
    addresses,
    onSetAddresses,
    placeholder,
    bulkPlaceholder,
    formatHint,
    addressing,
    getExplorerUrl,
  } = props;
  const anchor = roleAnchor(roleDef.name);
  const inspected = useIsInspected(anchor);

  return (
    <div
      data-config-anchor={anchor}
      aria-current={inspected ? 'true' : undefined}
      className={cn(
        'space-y-2 rounded-lg border border-border p-4',
        inspected && 'ring-1 ring-primary'
      )}
    >
      <div>
        <Label className="text-base font-medium">{roleDef.name}</Label>
        <p className="text-sm text-muted-foreground">{roleDef.description}</p>
      </div>
      <AddressListField
        value={[...addresses]}
        onChange={onSetAddresses}
        placeholder={placeholder}
        bulkPlaceholder={bulkPlaceholder}
        formatHint={formatHint}
        addressing={addressing}
        getExplorerUrl={getExplorerUrl}
      />
    </div>
  );
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
        {visibleRoles.map((roleDef) => (
          <OperatorRoleRow
            key={roleDef.id}
            roleDef={roleDef}
            addresses={getAddressesForRole(roleDef.name)}
            onSetAddresses={(next) => handleSetRoleAddresses(roleDef, next)}
            placeholder={addressListCopy.placeholder}
            bulkPlaceholder={addressListCopy.bulkPlaceholder}
            formatHint={addressListCopy.formatHint}
            addressing={addressing}
            getExplorerUrl={
              explorer ? (addr) => explorer.getExplorerUrl(addr) ?? undefined : undefined
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}
