import { Plus } from 'lucide-react';

import { SidebarButton } from '@openzeppelin/ui-components';

import { DEFAULT_TARGET_ID } from '../../../app/routes/wizardConstants';
import type { TargetCatalogEntry } from '../../../types/wizard';

interface TargetSelectorSidebarProps {
  targets: TargetCatalogEntry[];
  /** Current app target (from wizard store); used to highlight the active “Create …” row on `/wizard/:networkId`. */
  selectedTargetId: string | null;
  isWizardRoute: boolean;
  /**
   * When set, a draft row in Recent Assets is the sidebar selection — do not
   * highlight “Create … RWA” at the same time.
   */
  activeDraftId: string | null;
  onCreateForTarget: (targetId: string) => void;
}

export function TargetSelectorSidebar({
  targets,
  selectedTargetId,
  isWizardRoute,
  activeDraftId,
  onCreateForTarget,
}: TargetSelectorSidebarProps) {
  /** Align with `useWizardSession` / wizard page: null `targetId` means default target on `/wizard/...`. */
  const selectionForHighlight =
    isWizardRoute && selectedTargetId == null ? DEFAULT_TARGET_ID : selectedTargetId;

  return (
    <>
      {targets.map((target) => (
        <SidebarButton
          key={target.id}
          icon={<Plus className="size-4" />}
          disabled={!target.enabled}
          badge={!target.enabled && target.disabledLabel ? target.disabledLabel : undefined}
          isSelected={
            isWizardRoute && activeDraftId === null && selectionForHighlight === target.id
          }
          onClick={() => onCreateForTarget(target.id)}
        >
          Create {target.name} RWA
        </SidebarButton>
      ))}
    </>
  );
}
