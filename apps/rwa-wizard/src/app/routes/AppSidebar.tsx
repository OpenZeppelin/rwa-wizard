import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookUser,
  ExternalLink,
  LayoutDashboard,
  LayoutTemplate,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { SidebarButton, SidebarLayout, SidebarSection } from '@openzeppelin/ui-components';

import ContractsWizardIconSvg from '../../assets/icons/contracts-wizard-icon.svg';
import { AddressBookDialog } from '../../components/AddressBook/AddressBookDialog';
import { DraftImportDialog } from '../../features/draft-management/components/DraftImportDialog';
import { DraftList } from '../../features/draft-management/components/DraftList';
import { TargetSelectorSidebar } from '../../features/target-catalog/components/TargetSelectorSidebar';
import { useRwaWizardAnalytics } from '../../hooks/useRwaWizardAnalytics';
import { listTargets } from '../../registry/targets';
import { exportAllDraftsAsJson } from '../../services/download/exportDraftAsJson';
import { useDraftList, useWizardDraftStorage } from '../../storage';
import { isTargetId } from '../../types/wizard';
import { useWizardStore } from '../state/useWizardStore';
import { wizardStore } from '../state/wizardStore';
import { DEFAULT_TARGET_ID } from './wizardConstants';

interface AppSidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

/**
 * App-wide sidebar: navigation, target-driven draft creation, import/export
 * affordances, and the recent-drafts list. Subscribes to the wizard store
 * through narrow selectors so unrelated wizard-page state updates
 * (e.g. current step, selected target) do not cause the sidebar to re-render.
 */
export function AppSidebar({ mobileOpen, onMobileOpenChange }: AppSidebarProps): ReactElement {
  const activeDraftId = useWizardStore((s) => s.activeDraftId);
  const savingDraftId = useWizardStore((s) => s.savingDraftId);
  const draftListRefreshTick = useWizardStore((s) => s.draftListRefreshTick);

  const targets = useMemo(() => listTargets(), []);
  const draftList = useDraftList();
  const storage = useWizardDraftStorage();
  const { trackTargetSelected, trackDraftOpened, trackConfigExported } = useRwaWizardAnalytics();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isWizardRoute = location.pathname === '/wizard' || location.pathname.startsWith('/wizard/');
  const sidebarDraftSelectionId = isWizardRoute ? activeDraftId : null;

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
      // Narrow the catalog id (typed as `string` for storage tolerance) before
      // handing it to the strongly-typed store. Unknown targets silently stay
      // on the default — the target selector only surfaces `showInUI: true`
      // entries so this branch is a belt-and-braces guard.
      const resolved = isTargetId(targetId) ? targetId : DEFAULT_TARGET_ID;
      wizardStore.setTargetId(resolved);
      trackTargetSelected(resolved);
      navigate('/wizard');
      onMobileOpenChange(false);
    },
    [navigate, onMobileOpenChange, trackTargetSelected]
  );

  const handleLoadDraft = useCallback(
    (id: string) => {
      navigate('/wizard');
      onMobileOpenChange(false);
      wizardStore.setActiveDraft(id);
      trackDraftOpened('sidebar_recent');
    },
    [navigate, onMobileOpenChange, trackDraftOpened]
  );

  const handleExportAllDrafts = useCallback(async () => {
    trackConfigExported('all_drafts');
    await exportAllDraftsAsJson(storage);
  }, [storage, trackConfigExported]);

  const headerContent = (
    <div className="mb-8">
      <img src="/OZ-Logo-BlackBG.svg" alt="OpenZeppelin" className="h-6 w-auto" />
    </div>
  );

  const recentAssetsTitle = `Recent Assets${draftList.items.length > 0 ? `  ${draftList.items.length}` : ''}`;

  const footerContent = (
    <SidebarSection title="Other Tools">
      <SidebarButton
        icon={<img src={ContractsWizardIconSvg} alt="Contracts Wizard" className="size-4" />}
        href="https://wizard.openzeppelin.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="flex items-center gap-1.5">
          Contracts Wizard <ExternalLink className="size-3 text-gray-400" />
        </span>
      </SidebarButton>
      <SidebarButton icon={<Wallet className="size-4" />} disabled>
        Open Accounts
      </SidebarButton>
      <SidebarButton
        icon={<ShieldCheck className="size-4" />}
        href="https://rolemanager.openzeppelin.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="flex items-center gap-1.5">
          Role Manager <ExternalLink className="size-3 text-gray-400" />
        </span>
      </SidebarButton>
      <SidebarButton
        icon={<LayoutTemplate className="size-4" />}
        href="https://builder.openzeppelin.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="flex items-center gap-1.5">
          UI Builder <ExternalLink className="size-3 text-gray-400" />
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
          <SidebarButton
            icon={<BookUser className="size-4" />}
            onClick={() => setAddressBookOpen(true)}
          >
            Address Book
          </SidebarButton>
        </SidebarSection>

        <DraftImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImported={() => void draftList.refresh()}
        />
        <AddressBookDialog open={addressBookOpen} onOpenChange={setAddressBookOpen} />

        <SidebarSection title={recentAssetsTitle} grow>
          <DraftList
            activeDraftId={activeDraftId}
            sidebarDraftSelectionId={sidebarDraftSelectionId}
            savingDraftId={savingDraftId}
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
