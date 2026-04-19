import { Plus } from 'lucide-react';

import { SidebarButton } from '@openzeppelin/ui-components';

import type { TargetCatalogEntry } from '../../../types/wizard';

interface TargetSelectorSidebarProps {
  targets: TargetCatalogEntry[];
  onCreateForTarget: (targetId: string) => void;
}

export function TargetSelectorSidebar({ targets, onCreateForTarget }: TargetSelectorSidebarProps) {
  return (
    <>
      {targets.map((target) => (
        <SidebarButton
          key={target.id}
          icon={<Plus className="size-4" />}
          disabled={!target.enabled}
          badge={!target.enabled && target.disabledLabel ? target.disabledLabel : undefined}
          onClick={() => onCreateForTarget(target.id)}
        >
          Create {target.name} RWA
        </SidebarButton>
      ))}
    </>
  );
}
