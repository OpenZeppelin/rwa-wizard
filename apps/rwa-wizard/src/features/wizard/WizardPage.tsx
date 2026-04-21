import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { WizardLayout } from '@openzeppelin/ui-components';

import { useWizardNetworkRoute } from './hooks/useWizardNetworkRoute';
import { useWizardSession } from './hooks/useWizardSession';
import { useWizardSteps } from './hooks/useWizardSteps';

import { CopyProvider } from '../../app/providers/CopyProvider';
import { DEFAULT_WIZARD_NETWORK_ID, wizardPath } from '../../app/routes/wizardPaths';
import { wizardStore } from '../../app/state/wizardStore';
import { ErrorBannerStack } from '../../components/shared';
import { useRwaWizardAnalytics } from '../../hooks/useRwaWizardAnalytics';
import { exportDraftAsJson } from '../../services/download/exportDraftAsJson';
import { AdapterCapabilitiesProvider } from '../../services/runtime';
import { useWizardDraftStorage } from '../../storage';
import { GenerationDialog } from '../generation/components/GenerationDialog';

/**
 * Wizard page shell at `/wizard/:networkId`. Network id matches adapter
 * `NetworkConfig.id` (e.g. `stellar-testnet`). The heavy lifting (draft hydration,
 * autosave, target runtime, generation) is delegated to `useWizardSession`;
 * step JSX and ordering is delegated to `useWizardSteps`. This component
 * is left responsible only for layout, error banner plumbing, route/deployment
 * sync, and the two buttons on the last step (primary + secondary).
 */
export function WizardPage(): ReactElement {
  const navigate = useNavigate();
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

  const {
    trackWizardStep,
    trackConfigExported,
    trackProjectGenerated,
    trackGenerationFailed,
    trackWizardCancelled,
    trackZipDownloadClicked,
  } = useRwaWizardAnalytics();

  useWizardNetworkRoute(draftState, activeDraftId);

  const deploymentTarget = draftState.config.deployment.target;
  const presetNetworkId = deploymentTarget.kind === 'preset' ? deploymentTarget.networkId : null;

  useEffect(() => {
    if (presetNetworkId) {
      wizardStore.setActiveNetworkId(presetNetworkId);
    } else {
      wizardStore.setActiveNetworkId(null);
    }
    return () => {
      wizardStore.setActiveNetworkId(null);
    };
  }, [presetNetworkId]);

  const generationOutcomeKeyRef = useRef<string | null>(null);

  const codegenInfoBlurb = useMemo(
    () => codegenService?.getCodegenInfoBlurb?.() ?? null,
    [codegenService]
  );

  const { steps, orderedStepIds } = useWizardSteps({
    draftState,
    targetSnapshot,
    adapterCaps,
    codegenService,
    codegenInfoBlurb,
    isGenerating,
  });

  const currentStepIndex = orderedStepIds.indexOf(currentStep);
  const effectiveStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  useEffect(() => {
    if (generationJobState.phase !== 'success' && generationJobState.phase !== 'error') {
      return;
    }
    const completedAt = generationJobState.completedAt;
    if (!completedAt) return;

    const outcomeKey = `${generationJobState.phase}-${generationJobState.draftId}-${completedAt.getTime()}`;
    if (generationOutcomeKeyRef.current === outcomeKey) return;
    generationOutcomeKeyRef.current = outcomeKey;

    if (generationJobState.phase === 'success') {
      trackProjectGenerated(selectedTargetId, generationJobState.zipFileName ?? 'unknown');
    } else {
      trackGenerationFailed(selectedTargetId, generationJobState.errorMessage ?? 'unknown');
    }
  }, [generationJobState, selectedTargetId, trackProjectGenerated, trackGenerationFailed]);

  const handleStepChange = useCallback(
    (index: number) => {
      const stepId = orderedStepIds[index];
      if (stepId) {
        wizardStore.setCurrentStep(stepId);
        trackWizardStep(index + 1, stepId);
      }
    },
    [orderedStepIds, trackWizardStep]
  );

  const handleLastStepPrimary = useCallback(() => {
    void generate();
  }, [generate]);

  const handleLastStepSecondary = useCallback(async () => {
    if (!activeDraftId) return;
    trackConfigExported('single_draft');
    await exportDraftAsJson(activeDraftId, storage);
  }, [storage, activeDraftId, trackConfigExported]);

  const handleCancel = useCallback(() => {
    trackWizardCancelled(selectedTargetId);
    resetSession();
    navigate(wizardPath(DEFAULT_WIZARD_NETWORK_ID), { replace: true });
  }, [resetSession, selectedTargetId, trackWizardCancelled, navigate]);

  const handleDownload = useCallback(() => {
    trackZipDownloadClicked(selectedTargetId);
    download();
  }, [download, selectedTargetId, trackZipDownloadClicked]);

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
            onCancel={handleCancel}
            lastStepLabel={isGenerating ? 'Generating…' : 'Generate Project'}
            onLastStepPrimary={handleLastStepPrimary}
            lastStepSecondaryLabel="Export Configuration"
            onLastStepSecondary={handleLastStepSecondary}
            lastStepSecondaryDisabled={!activeDraftId}
          />
          <GenerationDialog
            jobState={generationJobState}
            isGenerating={isGenerating}
            onDownload={handleDownload}
            onRetry={handleLastStepPrimary}
            onReset={reset}
          />
        </main>
      </AdapterCapabilitiesProvider>
    </CopyProvider>
  );
}
