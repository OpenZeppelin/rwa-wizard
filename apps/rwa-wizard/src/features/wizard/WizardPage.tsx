import { useCallback } from 'react';

import { WizardLayout } from '@openzeppelin/ui-components';

import { useWizardSession } from './hooks/useWizardSession';
import { useWizardSteps } from './hooks/useWizardSteps';

import { CopyProvider } from '../../app/providers/CopyProvider';
import { wizardStore } from '../../app/state/wizardStore';
import { ErrorBannerStack } from '../../components/shared';
import { exportDraftAsJson } from '../../services/download/exportDraftAsJson';
import { AdapterCapabilitiesProvider } from '../../services/runtime';
import { useWizardDraftStorage } from '../../storage';
import { GenerationDialog } from '../generation/components/GenerationDialog';

/**
 * Wizard page shell at `/wizard`. The heavy lifting (draft hydration,
 * autosave, target runtime, generation) is delegated to `useWizardSession`;
 * step JSX and ordering is delegated to `useWizardSteps`. This component
 * is left responsible only for layout, error banner plumbing, and the
 * two buttons on the last step (primary + secondary).
 */
export function WizardPage(): React.ReactElement {
  const session = useWizardSession();
  const storage = useWizardDraftStorage();

  const {
    activeDraftId,
    currentStep,
    selectedTargetId,
    draftState,
    runtime,
    generation,
    persistError,
    clearPersistError,
    resetKey,
    resetSession,
  } = session;
  const { targetSnapshot, adapterCaps, codegenService, targetLoadError, clearTargetLoadError } =
    runtime;
  const { generate, isGenerating, jobState: generationJobState, download, reset } = generation;

  const { steps, orderedStepIds } = useWizardSteps({
    draftState,
    targetSnapshot,
    adapterCaps,
    codegenService,
    isGenerating,
  });

  const currentStepIndex = orderedStepIds.indexOf(currentStep);
  const effectiveStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  const handleStepChange = useCallback(
    (index: number) => {
      const stepId = orderedStepIds[index];
      if (stepId) wizardStore.setCurrentStep(stepId);
    },
    [orderedStepIds]
  );

  const handleLastStepPrimary = useCallback(() => {
    void generate();
  }, [generate]);

  const handleLastStepSecondary = useCallback(async () => {
    if (!activeDraftId) return;
    await exportDraftAsJson(activeDraftId, storage);
  }, [storage, activeDraftId]);

  const layoutKey = `${activeDraftId ?? 'new'}-${resetKey}`;

  return (
    <CopyProvider targetId={selectedTargetId}>
      <AdapterCapabilitiesProvider value={adapterCaps}>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ErrorBannerStack
            entries={[
              targetLoadError && {
                id: 'target-load',
                message: targetLoadError,
                onDismiss: clearTargetLoadError,
              },
              persistError && {
                id: 'persist',
                message: persistError,
                onDismiss: clearPersistError,
              },
            ]}
          />
          <WizardLayout
            key={layoutKey}
            variant="vertical"
            steps={steps}
            currentStepIndex={effectiveStepIndex}
            onStepChange={handleStepChange}
            onCancel={resetSession}
            lastStepLabel={isGenerating ? 'Generating…' : 'Generate Project'}
            onLastStepPrimary={handleLastStepPrimary}
            lastStepSecondaryLabel="Export Configuration"
            onLastStepSecondary={handleLastStepSecondary}
            lastStepSecondaryDisabled={!activeDraftId}
          />
          <GenerationDialog
            jobState={generationJobState}
            isGenerating={isGenerating}
            onDownload={download}
            onRetry={handleLastStepPrimary}
            onReset={reset}
          />
        </main>
      </AdapterCapabilitiesProvider>
    </CopyProvider>
  );
}
