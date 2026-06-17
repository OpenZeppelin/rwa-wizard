import { Check, ExternalLink } from 'lucide-react';
import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';

import type { ComplianceModuleSelection } from '@openzeppelin/rwa-config';
import { cn } from '@openzeppelin/ui-utils';

import { useCopy } from '../../../../app/providers/useCopy';
import { Badge } from '../../../../components/shared/Badge';
import { InfoTooltip } from '../../../../components/shared/InfoTooltip';
import type { ComplianceModuleOption } from '../../../../types/wizard';
import { ModuleConfigPanel } from './ModuleConfigPanel';

interface ModuleCatalogProps {
  availableModules: ComplianceModuleOption[];
  selectedModuleIds: Set<string>;
  selectedModules: ComplianceModuleSelection[];
  onToggleModule: (moduleId: string) => void;
  onConfigChange: (moduleId: string, config: Record<string, unknown>) => void;
}

const HOOK_DISPLAY: Record<string, string> = {
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
  selectedModules,
  onToggleModule,
  onConfigChange,
}: ModuleCatalogProps) {
  if (availableModules.length === 0) {
    return <EmptyModuleCatalog />;
  }

  return (
    <div className="space-y-3">
      {availableModules.map((mod) => {
        const selected = selectedModuleIds.has(mod.id);
        const selection = selected ? selectedModules.find((s) => s.moduleId === mod.id) : undefined;

        return (
          <ModuleRow
            key={mod.id}
            module={mod}
            selected={selected}
            config={selection?.config ?? {}}
            onToggle={onToggleModule}
            onConfigChange={onConfigChange}
          />
        );
      })}
    </div>
  );
}

interface ModuleRowProps {
  module: ComplianceModuleOption;
  selected: boolean;
  config: Record<string, unknown>;
  onToggle: (moduleId: string) => void;
  onConfigChange: (moduleId: string, config: Record<string, unknown>) => void;
}

function EmptyModuleCatalog() {
  const emptyNotice = useCopy().notice('compliance.module-catalog.empty');
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-sm text-muted-foreground">{emptyNotice.description}</p>
    </div>
  );
}

function ModuleRow({ module, selected, config, onToggle, onConfigChange }: ModuleRowProps) {
  const underReviewNotice = useCopy().notice('compliance.module-catalog.under-review-label');
  const handleClick = useCallback(() => onToggle(module.id), [module.id, onToggle]);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(module.id);
      }
    },
    [module.id, onToggle]
  );

  const handleConfigChange = useCallback(
    (cfg: Record<string, unknown>) => onConfigChange(module.id, cfg),
    [module.id, onConfigChange]
  );

  const isUnderReview = module.review.state === 'under-review';
  const hasConfigFields = module.configFields.length > 0;

  return (
    <div
      className={cn(
        'group rounded-lg border-2 transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/40 hover:bg-muted/30'
      )}
    >
      <div
        role="checkbox"
        aria-checked={selected}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="flex cursor-pointer items-start gap-4 p-4"
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
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{module.name}</p>
            {isUnderReview && (
              <span
                className="inline-flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-600">
                  {underReviewNotice.description}
                </Badge>
                <InfoTooltip label="About the Under Review badge">
                  {underReviewNotice.infoCopy}
                </InfoTooltip>
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{module.description}</p>

          {isUnderReview && module.review.prUrl && (
            <a
              href={module.review.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              Review PR
            </a>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {module.requiredHooks.map((hook) => (
              <Badge key={hook} variant="outline" className="text-[11px]">
                {hookLabel(hook)}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {selected && hasConfigFields && (
        <div
          className="border-t border-border/60 px-4 pb-4 pt-3"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-xs font-medium text-muted-foreground">Configuration</p>
          <ModuleConfigPanel module={module} config={config} onChange={handleConfigChange} />
        </div>
      )}
    </div>
  );
}
