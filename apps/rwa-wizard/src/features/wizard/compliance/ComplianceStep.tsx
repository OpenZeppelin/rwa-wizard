import { useCallback, useMemo } from 'react';

import type { ComplianceConfig, ComplianceModuleSelection } from '@openzeppelin/rwa-config';

import type { ComplianceHookMeta, ComplianceModuleOption } from '../../../types/wizard';
import { HookWiringPreview } from './HookWiringPreview';
import { ModuleCatalog } from './ModuleCatalog';

interface ComplianceStepProps {
  compliance: ComplianceConfig;
  availableModules: ComplianceModuleOption[];
  complianceHooks: readonly ComplianceHookMeta[];
  maxModulesPerHook: number;
  onUpdate: (patch: Partial<ComplianceConfig>) => void;
}

function deriveHookRegistrations(
  moduleId: string,
  supportedHooks: string[]
): ComplianceModuleSelection[] {
  return supportedHooks.map((hook) => ({ moduleId, hook }));
}

export function ComplianceStep({
  compliance,
  availableModules,
  complianceHooks,
  onUpdate,
}: ComplianceStepProps) {
  const selectedModuleIds = useMemo(
    () => new Set(compliance.modules.map((m) => m.moduleId)),
    [compliance.modules]
  );

  const handleToggleModule = useCallback(
    (moduleId: string) => {
      if (compliance.modules.some((m) => m.moduleId === moduleId)) {
        onUpdate({ modules: compliance.modules.filter((m) => m.moduleId !== moduleId) });
      } else {
        const meta = availableModules.find((m) => m.id === moduleId);
        if (!meta) return;
        const registrations = deriveHookRegistrations(moduleId, meta.supportedHooks);
        onUpdate({ modules: [...compliance.modules, ...registrations] });
      }
    },
    [compliance.modules, availableModules, onUpdate]
  );

  const hookRegistrations = new Map<string, string[]>();
  for (const sel of compliance.modules) {
    const list = hookRegistrations.get(sel.hook) ?? [];
    if (!list.includes(sel.moduleId)) list.push(sel.moduleId);
    hookRegistrations.set(sel.hook, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Compliance Modules</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select which compliance policies to enforce. Each module is automatically registered on
          the hooks it requires — you don&apos;t need to wire them manually.
        </p>
      </div>

      <ModuleCatalog
        availableModules={availableModules}
        selectedModuleIds={selectedModuleIds}
        onToggleModule={handleToggleModule}
      />

      {compliance.modules.length > 0 && (
        <HookWiringPreview
          complianceHooks={complianceHooks}
          hookRegistrations={hookRegistrations}
          availableModules={availableModules}
        />
      )}
    </div>
  );
}
