import type { AccessControlConfig, OwnershipModel } from '@openzeppelin/rwa-config';

import type { OperatorRoleMeta } from '../../../types/wizard';
import { OperatorRolesSection } from './OperatorRolesSection';
import { OwnershipModelSection } from './OwnershipModelSection';

interface AccessControlStepProps {
  accessControl: AccessControlConfig;
  documentManagerEnabled: boolean;
  operatorRoles: readonly OperatorRoleMeta[];
  onUpdate: (patch: Partial<AccessControlConfig>) => void;
}

export function AccessControlStep({
  accessControl,
  documentManagerEnabled,
  operatorRoles,
  onUpdate,
}: AccessControlStepProps) {
  const handleOwnershipChange = (model: OwnershipModel) => {
    onUpdate({ ownership: model });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Roles & Access Control</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define the ownership structure for your RWA token contract.
        </p>
      </div>

      <OwnershipModelSection ownership={accessControl.ownership} onUpdate={handleOwnershipChange} />
      <OperatorRolesSection
        accessControl={accessControl}
        documentManagerEnabled={documentManagerEnabled}
        operatorRoles={operatorRoles}
        onUpdate={onUpdate}
      />
    </div>
  );
}
