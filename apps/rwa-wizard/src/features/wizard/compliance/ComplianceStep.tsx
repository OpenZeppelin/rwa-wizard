import { useCallback } from 'react';

import type { ComplianceConfig, ComplianceModuleSelection } from '@openzeppelin/rwa-config';

import type { ComplianceHookMeta, ComplianceModuleOption } from '../../../types/wizard';
import { ComplianceHookCard } from './ComplianceHookCard';

interface ComplianceStepProps {
  compliance: ComplianceConfig;
  availableModules: ComplianceModuleOption[];
  complianceHooks: readonly ComplianceHookMeta[];
  maxModulesPerHook: number;
  onUpdate: (patch: Partial<ComplianceConfig>) => void;
}

const FUND_TAG_HOOKS = new Set(['canTransfer', 'transferred', 'created', 'destroyed']);

export function ComplianceStep({
  compliance,
  availableModules,
  complianceHooks,
  maxModulesPerHook,
  onUpdate,
}: ComplianceStepProps) {
  const handleAddModule = useCallback(
    (hook: string, moduleId: string) => {
      const selection: ComplianceModuleSelection = { moduleId, hook };
      onUpdate({ modules: [...compliance.modules, selection] });
    },
    [compliance.modules, onUpdate]
  );

  const handleRemoveModule = useCallback(
    (_hook: string, moduleIndex: number) => {
      onUpdate({ modules: compliance.modules.filter((_, i) => i !== moduleIndex) });
    },
    [compliance.modules, onUpdate]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Compliance Framework</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure transfer restrictions and validation rules using compliance hooks.
        </p>
      </div>

      {complianceHooks.map((meta) => (
        <ComplianceHookCard
          key={meta.hook}
          hook={meta.hook}
          displayName={meta.displayName}
          description={meta.description}
          modules={compliance.modules}
          availableModules={availableModules}
          maxModulesPerHook={maxModulesPerHook}
          onAddModule={handleAddModule}
          onRemoveModule={handleRemoveModule}
          fundTag={FUND_TAG_HOOKS.has(meta.hook)}
        />
      ))}

      {availableModules.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No compliance modules are available for the selected target.
        </p>
      )}
    </div>
  );
}
