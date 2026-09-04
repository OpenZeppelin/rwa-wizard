import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { WizardLayout } from '@openzeppelin/ui-components';

import { SyncDeployReadinessToConfig } from './components/SyncDeployReadinessToConfig';
import { DeployReadinessProvider } from './context/DeployReadinessProvider';
import { useDeployReadiness } from './context/useDeployReadiness';
import { useWizardNetworkRoute } from './hooks/useWizardNetworkRoute';
import { useWizardSession } from './hooks/useWizardSession';
import { useWizardSteps } from './hooks/useWizardSteps';

import { CopyProvider } from '../../app/providers/CopyProvider';
import { DEFAULT_WIZARD_NETWORK_ID, wizardPath } from '../../app/routes/wizardPaths';
import { wizardStore } from '../../app/state/wizardStore';
import { ErrorBannerStack } from '../../components/shared';
import { useAnalyticsNetworkContext } from '../../hooks/useAnalyticsNetworkContext';
import { useRwaWizardAnalytics } from '../../hooks/useRwaWizardAnalytics';
import {
  getDeployGuidanceFromService,
  resolveIncludeIdentitySupport,
} from '../../services/codegen/deployReadiness';
import { exportDraftAsJson } from '../../services/download/exportDraftAsJson';
import { AdapterCapabilitiesProvider } from '../../services/runtime';
import { useWizardDraftStorage } from '../../storage';
import {
  CodePreviewDrawer,
  CodePreviewProvenanceProvider,
  CodePreviewRevealProvider,
  CodePreviewTrigger,
  useCodePreview,
  WIZARD_DOCK_MENU_POSITIONS,
} from '../code-preview';
import { GenerationDialog } from '../generation/components/GenerationDialog';
import { InspectedAnchorProvider } from './inspected-anchor';

/**
 * Wizard page shell at `/wizard/:networkId`. Network id matches adapter
 * `NetworkConfig.id` (e.g. `stellar-testnet`). The heavy lifting (draft hydration,
 * autosave, target runtime, generation) is delegated to `useWizardSession`;
 * step JSX and ordering is delegated to `useWizardSteps`. This component
 * is left responsible only for layout, error banner plumbing, route/deployment
 * sync, and the two buttons on the last step (primary + secondary).
 */
export function WizardPage(): ReactElement {
  return (
    <DeployReadinessProvider>
      <WizardPageContent />
    </DeployReadinessProvider>
  );
}

/** Resets deploy-readiness toggles when the active draft or session reset changes. */
function ResetDeployReadinessOnDraftChange({ token }: { token: string }): null {
  const { setSignerAcknowledged, setIncludeIdentitySupport } = useDeployReadiness();

  useEffect(() => {
    setSignerAcknowledged(false);
    setIncludeIdentitySupport(false);
  }, [token, setSignerAcknowledged, setIncludeIdentitySupport]);

  return null;
}

function WizardPageContent(): ReactElement {
  const navigate = useNavigate();
  const { signerAcknowledged, includeIdentitySupport } = useDeployReadiness();
  const session = useWizardSession({ includeIdentitySupport });
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
  const {
    targetSnapshot,
    adapterCaps,
    codegenService,
    isRuntimeLoading,
    targetLoadError,
    clearTargetLoadError,
  } = runtime;
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
  const presetEcosystem = deploymentTarget.kind === 'preset' ? deploymentTarget.ecosystem : null;
  const { networkId: routeNetworkId } = useParams<{ networkId: string }>();

  // Network dimensions for every wizard-flow analytics event. Same precedence
  // as the context network below: preset deployment first, URL segment second.
  const analyticsNetwork = useAnalyticsNetworkContext(
    presetNetworkId ?? routeNetworkId,
    presetEcosystem
  );

  // Sync the wizard's "context network" used by `AliasLabelBridge` for alias
  // resolution and creation. Prefer the deployment preset network, but fall
  // back to the URL `:networkId` so that custom-deployment drafts still
  // produce network-scoped aliases (otherwise pencil-saved aliases would
  // become global records that the network-filtered Address Book hides).
  useEffect(() => {
    const contextNetworkId = presetNetworkId ?? routeNetworkId ?? null;
    wizardStore.setActiveNetworkId(contextNetworkId);
    return () => {
      wizardStore.setActiveNetworkId(null);
    };
  }, [presetNetworkId, routeNetworkId]);

  const generationOutcomeKeyRef = useRef<string | null>(null);

  const codegenInfoBlurb = useMemo(
    () => codegenService?.getCodegenInfoBlurb?.() ?? null,
    [codegenService]
  );

  const deployGuidance = useMemo(
    () => getDeployGuidanceFromService(codegenService, draftState.config),
    [codegenService, draftState.config]
  );

  const resolvedIdentitySupport = useMemo(
    () => resolveIncludeIdentitySupport(deployGuidance, includeIdentitySupport),
    [deployGuidance, includeIdentitySupport]
  );

  const preview = useCodePreview({
    codegenService,
    isCodegenServiceLoading: isRuntimeLoading,
    draftConfig: draftState.config,
    moduleCatalog: targetSnapshot?.availableModules ?? [],
    currentStepId: currentStep,
    // `WizardLayout` is remounted on `resetKey`, but this hook lives above that
    // boundary and would otherwise never learn the draft was replaced.
    draftEpoch: resetKey,
    includeIdentitySupport: resolvedIdentitySupport,
  });

  const { steps, orderedStepIds } = useWizardSteps({
    selectedTargetId,
    draftState,
    targetSnapshot,
    adapterCaps,
    codegenService,
    codegenInfoBlurb,
    isGenerating,
    deploySignerAcknowledged: deployGuidance == null || signerAcknowledged,
    includeIdentitySupport,
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
      trackProjectGenerated(
        selectedTargetId,
        generationJobState.zipFileName ?? 'unknown',
        analyticsNetwork
      );
    } else {
      trackGenerationFailed(
        selectedTargetId,
        generationJobState.errorMessage ?? 'unknown',
        analyticsNetwork
      );
    }
  }, [
    generationJobState,
    selectedTargetId,
    analyticsNetwork,
    trackProjectGenerated,
    trackGenerationFailed,
  ]);

  const handleStepChange = useCallback(
    (index: number) => {
      const stepId = orderedStepIds[index];
      if (stepId) {
        wizardStore.setCurrentStep(stepId);
        trackWizardStep(index + 1, stepId, analyticsNetwork);
      }
    },
    [orderedStepIds, analyticsNetwork, trackWizardStep]
  );

  const handleLastStepPrimary = useCallback(() => {
    void generate();
  }, [generate]);

  const handleLastStepSecondary = useCallback(async () => {
    if (!activeDraftId) return;
    trackConfigExported('single_draft', analyticsNetwork);
    await exportDraftAsJson(activeDraftId, storage);
  }, [storage, activeDraftId, analyticsNetwork, trackConfigExported]);

  const handleCancel = useCallback(() => {
    trackWizardCancelled(selectedTargetId, analyticsNetwork);
    resetSession();
    navigate(wizardPath(DEFAULT_WIZARD_NETWORK_ID), { replace: true });
  }, [resetSession, selectedTargetId, analyticsNetwork, trackWizardCancelled, navigate]);

  const handleDownload = useCallback(() => {
    trackZipDownloadClicked(selectedTargetId, analyticsNetwork);
    download();
  }, [download, selectedTargetId, analyticsNetwork, trackZipDownloadClicked]);

  // Use only `resetKey` (not `activeDraftId`) so that the layout does not
  // remount when autosave promotes a fresh form into a new draft id on the
  // user's first keystroke — that remount was dropping focus from the input
  // mid-typing. `resetKey` is bumped by `useWizardSession` whenever a real
  // remount is needed (Cancel, or hydrating a different draft from storage).
  const layoutKey = `wizard-${resetKey}`;

  return (
    <CopyProvider targetId={selectedTargetId}>
      <ResetDeployReadinessOnDraftChange token={`${resetKey}-${activeDraftId ?? 'none'}`} />
      {deployGuidance && <SyncDeployReadinessToConfig guidance={deployGuidance} />}
      <AdapterCapabilitiesProvider value={adapterCaps}>
        {/*
          Above BOTH the layout (which holds the writers) and the drawer (the
          only reader) — they are siblings, which is why the subject lives in a
          store rather than in state up here: state this high would re-render
          the whole form on every focus change. Inside `<main>` and not outside
          it, because the provider is not layout. INV-13, INV-26.

          The scope token drops the subject whenever the reset key, the active
          draft or the step changes. The step half is a genuine third input, not
          a redundancy: a claim topic still exists in the draft while the user is
          on the Compliance step, so the existence check alone would leave the
          column describing an item that is nowhere on screen. INV-23.
        */}
        <InspectedAnchorProvider
          scopeToken={`${resetKey}-${activeDraftId ?? 'none'}-${currentStep}`}
          modules={draftState.config.compliance.modules}
        >
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
            <CodePreviewRevealProvider
              revealInPreview={preview.showTrigger ? preview.revealInPreview : null} // SF-9 INV-12
            >
              <CodePreviewProvenanceProvider
                value={preview.showTrigger ? preview.provenance : null} // SF-5 INV-20
              >
                <WizardLayout
                  key={layoutKey}
                  variant="vertical"
                  steps={steps}
                  currentStepIndex={effectiveStepIndex}
                  onStepChange={handleStepChange}
                  onCancel={handleCancel}
                  navActions={
                    <CodePreviewTrigger
                      show={preview.showTrigger}
                      triggerProps={preview.triggerProps}
                    />
                  }
                  lastStepLabel={isGenerating ? 'Generating…' : 'Generate Project'}
                  onLastStepPrimary={handleLastStepPrimary}
                  lastStepSecondaryLabel="Export Configuration"
                  onLastStepSecondary={handleLastStepSecondary}
                  lastStepSecondaryDisabled={!activeDraftId}
                />
              </CodePreviewProvenanceProvider>
            </CodePreviewRevealProvider>
            {preview.showTrigger ? (
              <CodePreviewDrawer
                open={preview.persistence.open}
                onOpenChange={preview.setOpen}
                dockPosition={preview.persistence.dockPosition}
                size={preview.persistence.size}
                maxSize={preview.persistence.maxSize}
                onSizeChange={preview.setSize}
                sheetId={preview.sheetId}
                phase={preview.phase}
                selectedPath={preview.selectedPath}
                onSelectedPathChange={preview.setSelectedPath}
                files={preview.phase.kind === 'ready' ? preview.phase.files : null}
                changedPaths={
                  preview.phase.kind === 'ready' ? preview.phase.changedPaths : undefined
                }
                substitutedKeys={
                  preview.phase.kind === 'ready' || preview.phase.kind === 'error'
                    ? preview.phase.substitutedKeys
                    : []
                }
                errorMessages={preview.phase.kind === 'error' ? preview.phase.messages : undefined}
                sourceRevision={preview.sourceRevision}
                importLinks={preview.importLinks}
                tools={{
                  ...preview.layout,
                  // Wizard chrome: bottom + left only (top/right stay settable via API).
                  dockMenuPositions: WIZARD_DOCK_MENU_POSITIONS,
                }}
                reveal={preview.reveal}
                config={draftState.config}
                // The same expressions the two providers above carry, so the
                // drawer and the providers can never disagree about whether there
                // is a preview to ask about. INV-14.
                provenance={preview.showTrigger ? preview.provenance : null} // SF-5 INV-20
                onReveal={preview.showTrigger ? preview.revealInPreview : null} // SF-9 INV-12
              />
            ) : null}
            <GenerationDialog
              jobState={generationJobState}
              isGenerating={isGenerating}
              onDownload={handleDownload}
              onRetry={handleLastStepPrimary}
              onReset={reset}
              showPostDownloadSteps={deployGuidance != null}
            />
          </main>
        </InspectedAnchorProvider>
      </AdapterCapabilitiesProvider>
    </CopyProvider>
  );
}
