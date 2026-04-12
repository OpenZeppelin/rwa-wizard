import { Check } from 'lucide-react';
import { useCallback } from 'react';

import { cn } from '@openzeppelin/ui-utils';

import { Badge } from '../../../components/shared/Badge';
import type { ComplianceModuleOption } from '../../../types/wizard';

interface ModuleCatalogProps {
  availableModules: ComplianceModuleOption[];
  selectedModuleIds: Set<string>;
  onToggleModule: (moduleId: string) => void;
}

const HOOK_DISPLAY: Record<string, string> = {
  canTransfer: 'Can Transfer',
  canCreate: 'Can Create',
  transferred: 'Transferred',
  created: 'Created',
  destroyed: 'Destroyed',
};

function hookLabel(hook: string): string {
  return HOOK_DISPLAY[hook] ?? hook;
}

export function ModuleCatalog({
  availableModules,
  selectedModuleIds,
  onToggleModule,
}: ModuleCatalogProps) {
  if (availableModules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No compliance modules are available for the selected target.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {availableModules.map((mod) => (
        <ModuleRow
          key={mod.id}
          module={mod}
          selected={selectedModuleIds.has(mod.id)}
          onToggle={onToggleModule}
        />
      ))}
    </div>
  );
}

interface ModuleRowProps {
  module: ComplianceModuleOption;
  selected: boolean;
  onToggle: (moduleId: string) => void;
}

function ModuleRow({ module, selected, onToggle }: ModuleRowProps) {
  const handleClick = useCallback(() => onToggle(module.id), [module.id, onToggle]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(module.id);
      }
    },
    [module.id, onToggle]
  );

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors',
        selected
          ? 'border-primary/40 bg-primary/[0.03]'
          : 'border-border hover:border-border/80 hover:bg-muted/30'
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
        )}
      >
        {selected && <Check className="size-3.5" strokeWidth={3} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{module.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{module.description}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {module.supportedHooks.map((hook) => (
            <Badge key={hook} variant="outline" className="text-[11px]">
              {hookLabel(hook)}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
