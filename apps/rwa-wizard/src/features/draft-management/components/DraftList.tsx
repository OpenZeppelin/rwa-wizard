import { useDraftList } from '../../../storage';
import { DraftListItem } from './DraftListItem';

interface DraftListProps {
  activeDraftId: string | null;
  savingDraftId?: string | null;
  onLoadDraft: (id: string) => void;
}

export function DraftList({ activeDraftId, savingDraftId = null, onLoadDraft }: DraftListProps) {
  const { items: drafts, isLoading, error } = useDraftList();

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
          isActive={draft.id === activeDraftId}
          isSaving={draft.id === savingDraftId}
          onLoad={() => onLoadDraft(draft.id)}
        />
      ))}
    </div>
  );
}
