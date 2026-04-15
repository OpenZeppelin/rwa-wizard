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
import { TargetSelectorSidebar } from '../../features/target-catalog/components/TargetSelectorSidebar';
import { AccessControlStep } from '../../features/wizard/access-control/AccessControlStep';
import { AssetStep } from '../../features/wizard/asset/AssetStep';
import { ComplianceStep } from '../../features/wizard/compliance/ComplianceStep';
import { DeploymentPlaceholder } from '../../features/wizard/deployment/DeploymentPlaceholder';
import { IdentityStep } from '../../features/wizard/identity/IdentityStep';
import { ReviewStep } from '../../features/wizard/review/ReviewStep';
import { useWizardDraftState } from '../../features/wizard/state/useWizardDraftState';
import { getTargetCapabilitySnapshot, loadRuntime } from '../../registry/targetManager';
import { listTargets } from '../../registry/targets';
import type { RwaCodegenService } from '../../services/codegen/types';
import {
  exportAllDraftsAsJson,
  exportDraftAsJson,
} from '../../services/download/exportDraftAsJson';
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

  const selectedTargetId = storeState.targetId ?? 'stellar';
  const draftState = useWizardDraftState();

  const currentStepIndex = STEP_IDS.indexOf(storeState.currentStep);
  const effectiveStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  // Load the draft record when activeDraftId changes; clear form state when id is cleared (e.g. delete).
  useEffect(() => {
    async function syncDraftFromStorage() {
      const id = storeState.activeDraftId;
      if (!id) {
        draftState.resetConfig();
        return;
      }
      const draft = await storage.get(id);
      if (!draft) return;
      wizardStore.setTargetId(draft.targetId);
      wizardStore.setCurrentStep(draft.currentStep);
      draftState.setConfig(draft.config);
    }
    void syncDraftFromStorage();
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
  }, []);

  const { isSaving } = useDraftAutosave({
    draftId: storeState.activeDraftId,
    config: draftState.config,
    targetId: selectedTargetId,
    currentStep: storeState.currentStep,
    storage,
    onDraftCreated: handleDraftCreated,
    onPersistSuccess: handlePersistSuccess,
  });

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

  const handleExportDraft = useCallback(() => {
    const id = storeState.activeDraftId;
    if (!id) return;
    void exportDraftAsJson(id, storage).catch(() => {
      // Export failure is non-destructive; silently ignore.
    });
  }, [storeState.activeDraftId, storage]);

  const wizardSteps: WizardStepConfig[] = useMemo(() => {
    const availableModules = targetSnapshot?.availableModules ?? [];
    const ecosystemMetadata = targetSnapshot?.ecosystemMetadata;
    const adminControlsMeta = ecosystemMetadata?.administrativeControls ?? [];
    const identityControlsMeta = ecosystemMetadata?.identityControls ?? [];
    const operatorRoles = ecosystemMetadata?.operatorRoles ?? [];
    const complianceHooks = ecosystemMetadata?.complianceHooks ?? [];
    const maxModulesPerHook = ecosystemMetadata?.limits.maxModulesPerHook ?? 0;
    const maxTrustedIssuers = ecosystemMetadata?.limits.maxTrustedIssuers ?? 0;
    const documentManagerEnabled = draftState.config.token.documentManager.enabled;
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
        isValid: !!(draftState.config.token.name.trim() && draftState.config.token.symbol.trim()),
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
      },
      {
        id: 'compliance',
        title: 'Compliance',
        component: (
          <ComplianceStep
            compliance={draftState.config.compliance}
            availableModules={availableModules}
            complianceHooks={complianceHooks}
            maxModulesPerHook={maxModulesPerHook}
            onUpdate={draftState.updateCompliance}
          />
        ),
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
      },
      {
        id: 'review',
        title: 'Review',
        component: (
          <ReviewStep
            config={draftState.config}
            draftId={storeState.activeDraftId}
            codegenService={codegenService}
            availableModules={availableModules}
            onExport={handleExportDraft}
          />
        ),
      },
    ];

    if (isFeatureEnabled('DEPLOYMENT_STEP')) {
      steps.splice(steps.length - 1, 0, {
        id: 'deployment',
        title: 'Deployment',
        component: <DeploymentPlaceholder />,
      });
    }

    return steps;
  }, [draftState, targetSnapshot, codegenService, storeState.activeDraftId, handleExportDraft]);

  const handleCancel = useCallback(() => {
    wizardStore.reset();
    draftState.resetConfig();
  }, [draftState]);

  return (
    <AdapterCapabilitiesProvider value={adapterCaps}>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WizardLayout
          variant="vertical"
          steps={wizardSteps}
          currentStepIndex={effectiveStepIndex}
          onStepChange={handleStepChange}
          onCancel={handleCancel}
        />
      </main>
    </AdapterCapabilitiesProvider>
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
