import type { RWAConfig } from '@openzeppelin/rwa-config';

import { ConfigSummary } from '../../../components/shared/ConfigSummary';
import { WizardFrame } from '../../../components/shared/WizardFrame';
import { useExplorer } from '../../../services/runtime';
import type { ComplianceModuleOption } from '../../../types/wizard';

interface ReviewStepProps {
  config: RWAConfig;
  availableModules: ComplianceModuleOption[];
}

export function ReviewStep({ config, availableModules }: ReviewStepProps) {
  const explorer = useExplorer();

  return (
    <WizardFrame
      title="Review & Generate"
      description="Review your configuration and generate your project."
    >
      <ConfigSummary
        config={config}
        availableModules={availableModules}
        getExplorerUrl={explorer ? (addr) => explorer.getExplorerUrl(addr) : undefined}
      />
    </WizardFrame>
  );
}
