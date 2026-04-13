import type { AccessControlConfig, OwnershipModel } from '@openzeppelin/rwa-config';

import { WizardFrame } from '../../../components/shared/WizardFrame';
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
    <WizardFrame
      title="Roles & Access Control"
      description="Define the ownership structure for your RWA token contract."
    >
      <OwnershipModelSection ownership={accessControl.ownership} onUpdate={handleOwnershipChange} />
      <OperatorRolesSection
        accessControl={accessControl}
        documentManagerEnabled={documentManagerEnabled}
        operatorRoles={operatorRoles}
        onUpdate={onUpdate}
      />
    </WizardFrame>
  );
}
