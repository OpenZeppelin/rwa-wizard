import { wizardStore } from '../../../app/state/wizardStore';
import { exportDraftAsJson } from '../../../services/download/exportDraftAsJson';
import { useWizardDraftStorage } from '../../../storage';
import type { DraftListItem as DraftListItemType } from '../../../types/wizard';
import { DraftListItem } from './DraftListItem';

interface DraftListProps {
  activeDraftId: string | null;
  /**
   * Which draft row shows the sidebar “selected” style. Mirrors UI Builder’s
   * `currentLoadedConfigurationId` — parent derives this (e.g. only on `/wizard/:networkId`) so it can stay
   * in sync with top nav selection without clearing `activeDraftId` when outside the wizard route.
   */
  sidebarDraftSelectionId: string | null;
  savingDraftId?: string | null;
  onLoadDraft: (id: string) => void | Promise<void>;
  items: DraftListItemType[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function DraftList({
  activeDraftId,
  sidebarDraftSelectionId,
  savingDraftId = null,
  onLoadDraft,
  items: drafts,
  isLoading,
  error,
  refresh,
}: DraftListProps) {
  const storage = useWizardDraftStorage();
  const { remove, duplicate } = storage;

  const handleDelete = async (id: string) => {
    await remove(id);
    if (id === activeDraftId) {
      wizardStore.reset();
    }
    await refresh();
  };

  const handleDuplicate = async (id: string) => {
    const newId = await duplicate(id);
    await refresh();
    onLoadDraft(newId);
  };

  const handleExport = async (id: string) => {
    await exportDraftAsJson(id, storage);
  };

  if (isLoading) {
    return <p className="px-3 py-4 text-xs text-gray-400">Loading projects...</p>;
  }

  if (error) {
    return <p className="px-3 py-4 text-xs text-red-400">Unable to load saved projects.</p>;
  }

  if (drafts.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-gray-400">No projects yet. Create one to get started.</p>
    );
  }

  return (
    <div className="flex flex-col">
      {drafts.map((draft) => (
        <DraftListItem
          key={draft.id}
          draft={draft}
          isActive={draft.id === sidebarDraftSelectionId}
          isSaving={draft.id === savingDraftId}
          onLoad={() => onLoadDraft(draft.id)}
          onDelete={() => handleDelete(draft.id)}
          onDuplicate={() => handleDuplicate(draft.id)}
          onExport={() => handleExport(draft.id)}
        />
      ))}
    </div>
  );
}
