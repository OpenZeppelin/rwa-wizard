import { BookOpen, ExternalLink, LayoutDashboard, Settings, Sparkles } from 'lucide-react';
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

import { DraftList } from '../../features/draft-management/components/DraftList';
import { useDraftAutosave } from '../../features/draft-management/hooks/useDraftAutosave';
import { TargetSelectorSidebar } from '../../features/target-catalog/components/TargetSelectorSidebar';
import { AccessControlStep } from '../../features/wizard/access-control/AccessControlStep';
import { AssetStep } from '../../features/wizard/asset/AssetStep';
import { ComplianceStep } from '../../features/wizard/compliance/ComplianceStep';
import { DeploymentPlaceholder } from '../../features/wizard/deployment/DeploymentPlaceholder';
import { IdentityStep } from '../../features/wizard/identity/IdentityStep';
import { useWizardDraftState } from '../../features/wizard/state/useWizardDraftState';
import { listTargets } from '../../registry/targets';
import { useDraftList, useWizardDraftStorage } from '../../storage';
import type { ComplianceModuleOption, WizardStepId } from '../../types/wizard';
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
  const { items: drafts } = useDraftList();
  const location = useLocation();
  const navigate = useNavigate();

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

  const headerContent = (
    <div className="mb-8">
      <img src="/OZ-Logo-BlackBG.svg" alt="OpenZeppelin" className="h-6 w-auto" />
    </div>
  );

  const recentAssetsTitle = `Recent Assets${drafts.length > 0 ? `  ${drafts.length}` : ''}`;

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
        </SidebarSection>

        {/* Recent Assets */}
        <SidebarSection title={recentAssetsTitle} grow>
          <DraftList activeDraftId={storeState.activeDraftId} onLoadDraft={handleLoadDraft} />
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
  const [availableModules, setAvailableModules] = useState<ComplianceModuleOption[]>([]);

  const selectedTargetId = storeState.targetId ?? 'stellar';
  const draftState = useWizardDraftState();

  const currentStepIndex = STEP_IDS.indexOf(storeState.currentStep);
  const effectiveStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  // Load the draft record when activeDraftId changes
  useEffect(() => {
    async function loadDraft() {
      const id = storeState.activeDraftId;
      if (!id) return;
      const draft = await storage.get(id);
      if (!draft) return;
      wizardStore.setTargetId(draft.targetId);
      wizardStore.setCurrentStep(draft.currentStep);
      draftState.setConfig(draft.config);
    }
    void loadDraft();
    // Only re-run when the active draft id changes, not on every config edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeState.activeDraftId]);

  useEffect(() => {
    async function loadModules() {
      try {
        const { getCodegenService } = await import('../../services/codegen');
        const service = getCodegenService(selectedTargetId);
        const modules = await service.getAvailableModules();
        setAvailableModules(modules);
      } catch {
        setAvailableModules([]);
      }
    }
    void loadModules();
  }, [selectedTargetId]);

  const handleDraftCreated = useCallback((id: string) => {
    wizardStore.setActiveDraft(id);
  }, []);

  useDraftAutosave({
    draftId: storeState.activeDraftId,
    config: draftState.config,
    targetId: selectedTargetId,
    currentStep: storeState.currentStep,
    storage,
    onDraftCreated: handleDraftCreated,
  });

  const handleStepChange = useCallback((index: number) => {
    const stepId = STEP_IDS[index];
    if (stepId) wizardStore.setCurrentStep(stepId);
  }, []);

  const wizardSteps: WizardStepConfig[] = useMemo(() => {
    const steps: WizardStepConfig[] = [
      {
        id: 'asset',
        title: 'Asset',
        component: <AssetStep token={draftState.config.token} onUpdate={draftState.updateToken} />,
        isValid: !!(draftState.config.token.name.trim() && draftState.config.token.symbol.trim()),
      },
      {
        id: 'identity',
        title: 'Identity',
        component: (
          <IdentityStep
            identity={draftState.config.identityVerification}
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
            onUpdate={draftState.updateAccessControl}
          />
        ),
      },
      {
        id: 'review',
        title: 'Review',
        component: (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Review</h2>
            <p className="text-sm text-muted-foreground">
              Review your configuration before generating the project. Full review and generation
              features are available in Phase 4.
            </p>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">
              {JSON.stringify(draftState.config, null, 2)}
            </pre>
          </div>
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
  }, [draftState, availableModules]);

  const handleCancel = useCallback(() => {
    wizardStore.reset();
    draftState.resetConfig();
  }, [draftState]);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <WizardLayout
        variant="scrollable"
        steps={wizardSteps}
        currentStepIndex={effectiveStepIndex}
        onStepChange={handleStepChange}
        onCancel={handleCancel}
      />
    </main>
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
