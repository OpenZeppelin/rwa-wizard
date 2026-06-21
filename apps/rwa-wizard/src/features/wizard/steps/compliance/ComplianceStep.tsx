import { useCallback, useMemo } from 'react';

import {
  evaluateComplianceSelectionWarnings,
  type ComplianceModuleSelectionWarningRule,
} from '@openzeppelin/codegen-rwa-common';
import type { ComplianceConfig, RWAConfig } from '@openzeppelin/rwa-config';
import type { AddressingCapability } from '@openzeppelin/ui-types';

import { useStepCopy } from '../../../../app/providers/useStepCopy';
import { WizardFrame } from '../../../../components/shared/WizardFrame';
import { enrichComplianceSelectionWarning } from '../../../../registry/enrichEcosystemMetadata';
import type {
  ComplianceHookMeta,
  ComplianceModuleOption,
  ComplianceModuleSelectionWarningMeta,
  TargetId,
} from '../../../../types/wizard';
import { ComplianceSelectionWarnings } from './ComplianceSelectionWarnings';
import { HookWiringPreview } from './HookWiringPreview';
import { ModuleCatalog } from './ModuleCatalog';

interface ComplianceStepProps {
  targetId: TargetId;
  compliance: ComplianceConfig;
  initialSupply: RWAConfig['token']['initialSupply'];
  availableModules: ComplianceModuleOption[];
  complianceHooks: readonly ComplianceHookMeta[];
  moduleCategories: readonly string[];
  selectionWarningRules: readonly ComplianceModuleSelectionWarningRule[];
  configComplianceWarnings?: readonly ComplianceModuleSelectionWarningMeta[];
  isComplianceWarningBlocking?: (id: string) => boolean;
  addressing?: AddressingCapability;
  onUpdate: (patch: Partial<ComplianceConfig>) => void;
}

export function ComplianceStep({
  targetId,
  compliance,
  initialSupply,
  availableModules,
  complianceHooks,
  moduleCategories,
  selectionWarningRules,
  configComplianceWarnings = [],
  isComplianceWarningBlocking,
  addressing,
  onUpdate,
}: ComplianceStepProps) {
  const stepCopy = useStepCopy('compliance');
  const selectedModuleIds = useMemo(
    () => new Set(compliance.modules.map((entry) => entry.moduleId)),
    [compliance.modules]
  );

  const handleToggleModule = useCallback(
    (moduleId: string) => {
      if (compliance.modules.some((entry) => entry.moduleId === moduleId)) {
        onUpdate({ modules: compliance.modules.filter((entry) => entry.moduleId !== moduleId) });
      } else {
        onUpdate({ modules: [...compliance.modules, { moduleId }] });
      }
    },
    [compliance.modules, onUpdate]
  );

  const handleConfigChange = useCallback(
    (moduleId: string, config: Record<string, unknown>) => {
      onUpdate({
        modules: compliance.modules.map((entry) =>
          entry.moduleId === moduleId
            ? { ...entry, config: Object.keys(config).length > 0 ? config : undefined }
            : entry
        ),
      });
    },
    [compliance.modules, onUpdate]
  );

  const hookRegistrations = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const selection of compliance.modules) {
      const meta = availableModules.find((entry) => entry.id === selection.moduleId);
      if (!meta) continue;
      for (const hook of meta.requiredHooks) {
        const list = map.get(hook) ?? [];
        if (!list.includes(selection.moduleId)) list.push(selection.moduleId);
        map.set(hook, list);
      }
    }
    return map;
  }, [compliance.modules, availableModules]);

  const selectionWarnings = useMemo(() => {
    const ruleWarnings = evaluateComplianceSelectionWarnings(
      { compliance, initialSupply },
      compliance.modules.map((entry) => entry.moduleId),
      selectionWarningRules
    )
      .map((warning) => {
        const enriched = enrichComplianceSelectionWarning(targetId, warning);
        if (!enriched) return null;
        return {
          ...enriched,
          blocking: isComplianceWarningBlocking?.(warning.id) ?? false,
        };
      })
      .filter((warning): warning is NonNullable<typeof warning> => warning !== null);

    const merged = [...configComplianceWarnings];
    const seen = new Set(merged.map((warning) => warning.id));
    for (const warning of ruleWarnings) {
      if (!seen.has(warning.id)) {
        merged.push(warning);
        seen.add(warning.id);
      }
    }
    return merged;
  }, [
    targetId,
    compliance,
    initialSupply,
    selectionWarningRules,
    configComplianceWarnings,
    isComplianceWarningBlocking,
  ]);

  return (
    <WizardFrame {...stepCopy} spacing="space-y-8">
      <ModuleCatalog
        targetId={targetId}
        availableModules={availableModules}
        moduleCategories={moduleCategories}
        selectedModuleIds={selectedModuleIds}
        selectedModules={compliance.modules}
        onToggleModule={handleToggleModule}
        onConfigChange={handleConfigChange}
        addressing={addressing}
      />

      <ComplianceSelectionWarnings warnings={selectionWarnings} />

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
