import { Download } from 'lucide-react';
import { useCallback } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';
import { Button } from '@openzeppelin/ui-components';

import { ConfigSummary } from '../../../components/shared/ConfigSummary';
import { WizardFrame } from '../../../components/shared/WizardFrame';
import type { RwaCodegenService } from '../../../services/codegen/types';
import { useExplorer } from '../../../services/runtime';
import type { ComplianceModuleOption } from '../../../types/wizard';
import { GenerationErrorState } from '../../generation/components/GenerationErrorState';
import { GenerationStatusPanel } from '../../generation/components/GenerationStatusPanel';
import { useGenerationFlow } from '../../generation/hooks/useGenerationFlow';

interface ReviewStepProps {
  config: RWAConfig;
  draftId: string | null;
  codegenService: RwaCodegenService | null;
  availableModules: ComplianceModuleOption[];
  onExport: () => void;
}

export function ReviewStep({
  config,
  draftId,
  codegenService,
  availableModules,
  onExport,
}: ReviewStepProps) {
  const explorer = useExplorer();

  const generationFlow = useGenerationFlow({
    draftId,
    config,
    codegenService: codegenService!,
    autoDownload: true,
  });

  const { jobState, generate, reset, isGenerating } = generationFlow;
  const canGenerate = codegenService != null && !isGenerating && jobState.phase !== 'success';

  const handleGenerate = useCallback(() => {
    void generate();
  }, [generate]);

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

      {jobState.phase !== 'idle' && jobState.phase !== 'error' && (
        <GenerationStatusPanel
          phase={jobState.phase}
          message={jobState.phase === 'success' ? 'Project generated successfully.' : undefined}
          zipFileName={jobState.zipFileName}
        />
      )}

      {jobState.phase === 'error' && jobState.errorMessage && (
        <GenerationErrorState
          errorMessage={jobState.errorMessage}
          onRetry={handleGenerate}
          onReset={reset}
        />
      )}

      <div className="flex flex-col gap-4 md:flex-row">
        <Button variant="outline" className="flex-1" onClick={onExport} disabled={isGenerating}>
          <Download className="mr-2 size-4" />
          Export Configuration
        </Button>
        <Button className="flex-1" disabled={!canGenerate} onClick={handleGenerate}>
          {isGenerating ? (
            <>
              <span className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generating…
            </>
          ) : jobState.phase === 'success' ? (
            'Generated'
          ) : (
            'Generate Project'
          )}
        </Button>
      </div>
      {jobState.phase === 'success' && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={reset}>
            Generate Again
          </Button>
        </div>
      )}
    </WizardFrame>
  );
}
