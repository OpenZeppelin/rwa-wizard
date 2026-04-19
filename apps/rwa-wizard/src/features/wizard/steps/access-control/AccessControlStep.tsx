import type { AccessControlConfig, OwnershipModel } from '@openzeppelin/rwa-config';

import { useStepCopy } from '../../../../app/providers/useStepCopy';
import { WizardFrame } from '../../../../components/shared/WizardFrame';
import type { OperatorRoleMeta } from '../../../../types/wizard';
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
  const stepCopy = useStepCopy('access-control');
  const handleOwnershipChange = (model: OwnershipModel) => {
    onUpdate({ ownership: model });
  };

  return (
    <WizardFrame {...stepCopy}>
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
