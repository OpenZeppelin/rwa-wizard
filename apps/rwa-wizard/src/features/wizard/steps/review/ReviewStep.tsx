import type { RWAConfig } from '@openzeppelin/rwa-config';

import { useStepCopy } from '../../../../app/providers/useStepCopy';
import { ConfigSummary } from '../../../../components/shared/ConfigSummary';
import { WizardFrame } from '../../../../components/shared/WizardFrame';
import type { DeployGuidanceDTO } from '../../../../services/codegen/types';
import { useExplorer } from '../../../../services/runtime';
import type { ComplianceModuleOption } from '../../../../types/wizard';
import { DeployReadinessPanel } from './DeployReadinessPanel';

interface ReviewStepProps {
  config: RWAConfig;
  availableModules: ComplianceModuleOption[];
  deployGuidance: DeployGuidanceDTO | null;
  supportsIdentitySupport: boolean;
}

export function ReviewStep({
  config,
  availableModules,
  deployGuidance,
  supportsIdentitySupport,
}: ReviewStepProps) {
  const explorer = useExplorer();
  const stepCopy = useStepCopy('review');

  return (
    <WizardFrame {...stepCopy}>
      <div className="space-y-6">
        <ConfigSummary
          config={config}
          availableModules={availableModules}
          getExplorerUrl={explorer ? (addr) => explorer.getExplorerUrl(addr) : undefined}
        />
        {deployGuidance && (
          <DeployReadinessPanel
            guidance={deployGuidance}
            supportsIdentitySupport={supportsIdentitySupport}
          />
        )}
      </div>
    </WizardFrame>
  );
}
