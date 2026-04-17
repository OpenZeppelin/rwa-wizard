import { useCallback, useMemo } from 'react';

import type { ComplianceConfig } from '@openzeppelin/rwa-config';

import { WizardFrame } from '../../../components/shared/WizardFrame';
import type { ComplianceHookMeta, ComplianceModuleOption } from '../../../types/wizard';
import { HookWiringPreview } from './HookWiringPreview';
import { ModuleCatalog } from './ModuleCatalog';

interface ComplianceStepProps {
  compliance: ComplianceConfig;
  availableModules: ComplianceModuleOption[];
  complianceHooks: readonly ComplianceHookMeta[];
  onUpdate: (patch: Partial<ComplianceConfig>) => void;
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
        onUpdate({ modules: [...compliance.modules, { moduleId }] });
      }
    },
    [compliance.modules, onUpdate]
  );

  const handleConfigChange = useCallback(
    (moduleId: string, config: Record<string, unknown>) => {
      onUpdate({
        modules: compliance.modules.map((m) =>
          m.moduleId === moduleId
            ? { ...m, config: Object.keys(config).length > 0 ? config : undefined }
            : m
        ),
      });
    },
    [compliance.modules, onUpdate]
  );

  const hookRegistrations = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const sel of compliance.modules) {
      const meta = availableModules.find((m) => m.id === sel.moduleId);
      if (!meta) continue;
      for (const hook of meta.requiredHooks) {
        const list = map.get(hook) ?? [];
        if (!list.includes(sel.moduleId)) list.push(sel.moduleId);
        map.set(hook, list);
      }
    }
    return map;
  }, [compliance.modules, availableModules]);

  return (
    <WizardFrame
      title="Compliance Modules"
      description="Select which compliance policies to enforce. Each module is automatically registered on the hooks it requires — you don't need to wire them manually."
      spacing="space-y-8"
    >
      <ModuleCatalog
        availableModules={availableModules}
        selectedModuleIds={selectedModuleIds}
        selectedModules={compliance.modules}
        onToggleModule={handleToggleModule}
        onConfigChange={handleConfigChange}
      />

      {compliance.modules.length > 0 && (
        <HookWiringPreview
          complianceHooks={complianceHooks}
          hookRegistrations={hookRegistrations}
          availableModules={availableModules}
        />
      )}
    </WizardFrame>
  );
}
