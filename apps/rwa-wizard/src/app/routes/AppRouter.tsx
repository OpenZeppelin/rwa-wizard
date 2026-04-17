import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  ExternalLink,
  LayoutDashboard,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import {
  Footer,
  Header,
  SidebarButton,
  SidebarLayout,
  SidebarSection,
  WizardLayout,
  type WizardStepConfig,
} from '@openzeppelin/ui-components';

import { DraftImportDialog } from '../../features/draft-management/components/DraftImportDialog';
import { DraftList } from '../../features/draft-management/components/DraftList';
import { useDraftAutosave } from '../../features/draft-management/hooks/useDraftAutosave';
import { GenerationDialog } from '../../features/generation/components/GenerationDialog';
import { useGenerationFlow } from '../../features/generation/hooks/useGenerationFlow';
import { TargetSelectorSidebar } from '../../features/target-catalog/components/TargetSelectorSidebar';
import { AccessControlStep } from '../../features/wizard/access-control/AccessControlStep';
import { AssetStep } from '../../features/wizard/asset/AssetStep';
import { ComplianceStep } from '../../features/wizard/compliance/ComplianceStep';
import { DeploymentPlaceholder } from '../../features/wizard/deployment/DeploymentPlaceholder';
import { IdentityStep } from '../../features/wizard/identity/IdentityStep';
import { ReviewStep } from '../../features/wizard/review/ReviewStep';
import { useWizardDraftState } from '../../features/wizard/state/useWizardDraftState';
import { isStepValid } from '../../features/wizard/validation/stepValidators';
import { getTargetCapabilitySnapshot, loadRuntime } from '../../registry/targetManager';
import { listTargets } from '../../registry/targets';
import type { RwaCodegenService } from '../../services/codegen/types';
import { exportAllDraftsAsJson } from '../../services/download/exportDraftAsJson';
import type { TargetAdapterCapabilities } from '../../services/runtime';
import { AdapterCapabilitiesProvider } from '../../services/runtime';
import { useDraftList, useWizardDraftStorage } from '../../storage';
import type { TargetCapabilitySnapshot, WizardStepId } from '../../types/wizard';
import { isFeatureEnabled } from '../config/featureFlags';
import { wizardStore } from '../state/wizardStore';

const STEP_IDS: WizardStepId[] = ['asset', 'identity', 'compliance', 'access-control', 'review'];

function useWizardStoreState() {
  return useSyncExternalStore(wizardStore.subscribe, wizardStore.getState, wizardStore.getState);
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function AppSidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const storeState = useWizardStoreState();
  const targets = useMemo(() => listTargets(), []);
  const draftList = useDraftList();
  const storage = useWizardDraftStorage();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const draftListRefreshTick = useSyncExternalStore(
    wizardStore.subscribe,
    () => wizardStore.getState().draftListRefreshTick,
    () => 0
  );
  const location = useLocation();
  const navigate = useNavigate();

  const refreshDraftList = draftList.refresh;

  useEffect(() => {
    if (draftListRefreshTick === 0) return;
    void refreshDraftList();
  }, [draftListRefreshTick, refreshDraftList]);

  const handleNav = useCallback(
    (path: string) => {
      navigate(path);
      onMobileOpenChange(false);
    },
    [navigate, onMobileOpenChange]
  );

  const handleCreateForTarget = useCallback(
    (targetId: string) => {
      wizardStore.reset();
      wizardStore.setTargetId(targetId);
      navigate('/wizard');
      onMobileOpenChange(false);
    },
    [navigate, onMobileOpenChange]
  );

  const handleLoadDraft = useCallback(
    (id: string) => {
      navigate('/wizard');
      onMobileOpenChange(false);
      // The WizardPage will pick this up via the store.
      wizardStore.setActiveDraft(id);
    },
    [navigate, onMobileOpenChange]
  );

  const handleExportAllDrafts = useCallback(async () => {
    await exportAllDraftsAsJson(storage);
  }, [storage]);

  const headerContent = (
    <div className="mb-8">
      <img src="/OZ-Logo-BlackBG.svg" alt="OpenZeppelin" className="h-6 w-auto" />
    </div>
  );

  const recentAssetsTitle = `Recent Assets${draftList.items.length > 0 ? `  ${draftList.items.length}` : ''}`;

  const footerContent = (
    <SidebarSection title="Tools">
      <SidebarButton
        icon={<Settings className="size-4" />}
        href="https://roles.openzeppelin.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="flex items-center gap-1.5">
          Role Manager <ExternalLink className="size-3 text-gray-400" />
        </span>
      </SidebarButton>
      <SidebarButton
        icon={<BookOpen className="size-4" />}
        href="https://accounts.openzeppelin.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="flex items-center gap-1.5">
          Open Accounts <ExternalLink className="size-3 text-gray-400" />
        </span>
      </SidebarButton>
      <SidebarButton
        icon={<Sparkles className="size-4" />}
        href="https://wizard.openzeppelin.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="flex items-center gap-1.5">
          Contract Wizard <ExternalLink className="size-3 text-gray-400" />
        </span>
      </SidebarButton>
    </SidebarSection>
  );

  return (
    <SidebarLayout
      header={headerContent}
      footer={footerContent}
      mobileOpen={mobileOpen}
      onMobileOpenChange={onMobileOpenChange}
      mobileAriaLabel="Navigation menu"
    >
      <div className="flex w-full flex-col gap-12">
        {/* Navigation + create actions */}
        <SidebarSection>
          <SidebarButton
            icon={<LayoutDashboard className="size-4" />}
            isSelected={location.pathname === '/'}
            onClick={() => handleNav('/')}
          >
            Dashboard
          </SidebarButton>
          <TargetSelectorSidebar targets={targets} onCreateForTarget={handleCreateForTarget} />
          <SidebarButton
            icon={<ArrowDownToLine className="size-4" />}
            onClick={() => setImportDialogOpen(true)}
          >
            Import
          </SidebarButton>
          {draftList.items.length > 0 && (
            <SidebarButton
              icon={<ArrowUpFromLine className="size-4" />}
              onClick={() => void handleExportAllDrafts()}
            >
              Export
            </SidebarButton>
          )}
        </SidebarSection>

        <DraftImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImported={() => void draftList.refresh()}
        />

        {/* Recent Assets */}
        <SidebarSection title={recentAssetsTitle} grow>
          <DraftList
            activeDraftId={storeState.activeDraftId}
            savingDraftId={storeState.savingDraftId}
            onLoadDraft={handleLoadDraft}
            items={draftList.items}
            isLoading={draftList.isLoading}
            error={draftList.error}
            refresh={draftList.refresh}
          />
        </SidebarSection>
      </div>
    </SidebarLayout>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function DashboardPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome to the RWA Wizard. Select a target and create a new project from the sidebar.
        </p>
      </div>
    </div>
  );
}

function WizardPage() {
  const storeState = useWizardStoreState();
  const storage = useWizardDraftStorage();
  const [targetSnapshot, setTargetSnapshot] = useState<TargetCapabilitySnapshot | null>(null);
  const [adapterCaps, setAdapterCaps] = useState<TargetAdapterCapabilities | null>(null);
  const [codegenService, setCodegenService] = useState<RwaCodegenService | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);

  const selectedTargetId = storeState.targetId ?? 'stellar';
  const draftState = useWizardDraftState();

  const currentStepIndex = STEP_IDS.indexOf(storeState.currentStep);
  const effectiveStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  // Load the draft record when activeDraftId changes; clear form state when id is cleared (e.g. delete).
  // `isActive` guards against races when the user switches drafts while a prior `get` is still pending.
  useEffect(() => {
    let isActive = true;

    async function syncDraftFromStorage() {
      const id = storeState.activeDraftId;
      if (!id) {
        draftState.resetConfig();
        return;
      }
      const draft = await storage.get(id);
      if (!isActive) return;
      if (!draft) {
        // Draft was deleted (e.g. from another tab). Clear the active id and reset the form.
        wizardStore.setActiveDraft(null);
        draftState.resetConfig();
        return;
      }
      wizardStore.setTargetId(draft.targetId);
      wizardStore.setCurrentStep(draft.currentStep);
      draftState.setConfig(draft.config);
    }
    void syncDraftFromStorage();

    return () => {
      isActive = false;
    };
    // Only re-run when the active draft id changes, not on every config edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeState.activeDraftId]);

  useEffect(() => {
    let isActive = true;

    async function loadTarget() {
      try {
        const [snapshot, runtime] = await Promise.all([
          getTargetCapabilitySnapshot(selectedTargetId),
          loadRuntime(selectedTargetId),
        ]);
        if (isActive) {
          setTargetSnapshot(snapshot);
          setAdapterCaps(runtime.adapterCapabilities);
          setCodegenService(runtime.codegenService);
        }
      } catch {
        if (isActive) {
          setTargetSnapshot(null);
          setAdapterCaps(null);
          setCodegenService(null);
        }
      }
    }

    void loadTarget();

    return () => {
      isActive = false;
    };
  }, [selectedTargetId]);

  const handleDraftCreated = useCallback((id: string) => {
    wizardStore.setActiveDraft(id);
  }, []);

  const handlePersistSuccess = useCallback(() => {
    wizardStore.bumpDraftListRefresh();
    setPersistError(null);
  }, []);

  const handlePersistError = useCallback((kind: 'create' | 'save', err: unknown) => {
    const detail = err instanceof Error ? err.message : String(err);
    setPersistError(
      kind === 'create'
        ? `Unable to save this draft to your browser: ${detail}`
        : `Unable to update this draft: ${detail}`
    );
  }, []);

  const { isSaving } = useDraftAutosave({
    draftId: storeState.activeDraftId,
    config: draftState.config,
    targetId: selectedTargetId,
    currentStep: storeState.currentStep,
    storage,
    onDraftCreated: handleDraftCreated,
    onPersistSuccess: handlePersistSuccess,
    onPersistError: handlePersistError,
  });

  const generationFlow = useGenerationFlow({
    draftId: storeState.activeDraftId,
    config: draftState.config,
    codegenService,
    // The user explicitly saves the file from the success dialog — browsers
    // don't tell us whether a download actually lands on disk, so forcing an
    // auto-download would let the UI claim "downloaded" when the user could
    // have canceled the browser save dialog.
    autoDownload: false,
    // Real codegen often completes in single-digit ms, which makes the phase
    // list in the dialog flash by unreadably. A small per-phase floor turns
    // the progress into a perceptible animation without noticeably slowing
    // real generation (phases with real work still reflect actual duration).
    minPhaseDurationMs: 450,
  });

  const { generate, isGenerating } = generationFlow;

  const handleLastStepPrimary = useCallback(() => {
    void generate();
  }, [generate]);

  const handleLastStepSecondary = useCallback(async () => {
    await exportAllDraftsAsJson(storage);
  }, [storage]);

  useEffect(() => {
    const id = storeState.activeDraftId;
    if (isSaving && id) {
      wizardStore.setSavingDraftId(id);
    } else {
      wizardStore.setSavingDraftId(null);
    }
    return () => {
      wizardStore.setSavingDraftId(null);
    };
  }, [isSaving, storeState.activeDraftId]);

  const handleStepChange = useCallback((index: number) => {
    const stepId = STEP_IDS[index];
    if (stepId) wizardStore.setCurrentStep(stepId);
  }, []);

  const wizardSteps: WizardStepConfig[] = useMemo(() => {
    const availableModules = targetSnapshot?.availableModules ?? [];
    const ecosystemMetadata = targetSnapshot?.ecosystemMetadata;
    const adminControlsMeta = ecosystemMetadata?.administrativeControls ?? [];
    const identityControlsMeta = ecosystemMetadata?.identityControls ?? [];
    const operatorRoles = ecosystemMetadata?.operatorRoles ?? [];
    const complianceHooks = ecosystemMetadata?.complianceHooks ?? [];
    // Use Infinity while metadata is loading so the UI never falsely reports
    // "limit reached" during the initial render; the real limit replaces this
    // as soon as the adapter capability snapshot resolves.
    const maxTrustedIssuers =
      ecosystemMetadata?.limits.maxTrustedIssuers ?? Number.POSITIVE_INFINITY;
    const documentManagerEnabled = draftState.config.token.documentManager.enabled;

    const validationCtx = {
      addressing: adapterCaps?.addressing,
      availableModules,
    };
    const validityFor = (id: WizardStepId) => isStepValid(id, draftState.config, validationCtx);
    const reviewStepCanProceed = codegenService != null && !generationFlow.isGenerating;

    const steps: WizardStepConfig[] = [
      {
        id: 'asset',
        title: 'Asset',
        component: (
          <AssetStep
            token={draftState.config.token}
            adminControlsMeta={adminControlsMeta}
            onUpdate={draftState.updateToken}
          />
        ),
        isValid: validityFor('asset'),
      },
      {
        id: 'identity',
        title: 'Identity',
        component: (
          <IdentityStep
            identity={draftState.config.identityVerification}
            maxTrustedIssuers={maxTrustedIssuers}
            identityControlsMeta={identityControlsMeta}
            onUpdate={draftState.updateIdentity}
          />
        ),
        isValid: validityFor('identity'),
      },
      {
        id: 'compliance',
        title: 'Compliance',
        component: (
          <ComplianceStep
            compliance={draftState.config.compliance}
            availableModules={availableModules}
            complianceHooks={complianceHooks}
            onUpdate={draftState.updateCompliance}
          />
        ),
        isValid: validityFor('compliance'),
      },
      {
        id: 'access-control',
        title: 'Roles',
        component: (
          <AccessControlStep
            accessControl={draftState.config.accessControl}
            documentManagerEnabled={documentManagerEnabled}
            operatorRoles={operatorRoles}
            onUpdate={draftState.updateAccessControl}
          />
        ),
        isValid: validityFor('access-control'),
      },
      {
        id: 'review',
        title: 'Review',
        component: <ReviewStep config={draftState.config} availableModules={availableModules} />,
        isValid: validityFor('review') && reviewStepCanProceed,
      },
    ];

    if (isFeatureEnabled('DEPLOYMENT_STEP')) {
      steps.splice(steps.length - 1, 0, {
        id: 'deployment',
        title: 'Deployment',
        component: <DeploymentPlaceholder />,
        isValid: validityFor('deployment'),
      });
    }

    return steps;
  }, [draftState, targetSnapshot, adapterCaps, codegenService, generationFlow]);

  const [resetKey, setResetKey] = useState(0);

  const handleCancel = useCallback(() => {
    wizardStore.reset();
    draftState.resetConfig();
    setResetKey((k) => k + 1);
  }, [draftState]);

  const layoutKey = `${storeState.activeDraftId ?? 'new'}-${resetKey}`;

  return (
    <AdapterCapabilitiesProvider value={adapterCaps}>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {persistError && (
          <PersistErrorBanner message={persistError} onDismiss={() => setPersistError(null)} />
        )}
        <WizardLayout
          key={layoutKey}
          variant="vertical"
          steps={wizardSteps}
          currentStepIndex={effectiveStepIndex}
          onStepChange={handleStepChange}
          onCancel={handleCancel}
          lastStepLabel={isGenerating ? 'Generating…' : 'Generate Project'}
          onLastStepPrimary={handleLastStepPrimary}
          lastStepSecondaryLabel="Export drafts"
          onLastStepSecondary={handleLastStepSecondary}
        />
        <GenerationDialog
          jobState={generationFlow.jobState}
          isGenerating={generationFlow.isGenerating}
          onDownload={generationFlow.download}
          onRetry={handleLastStepPrimary}
          onReset={generationFlow.reset}
        />
      </main>
    </AdapterCapabilitiesProvider>
  );
}

function PersistErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground"
    >
      <span className="flex-1 text-muted-foreground">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <Header title="Real World Asset" onOpenSidebar={() => setMobileOpen(true)} />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/wizard" element={<WizardPage />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
