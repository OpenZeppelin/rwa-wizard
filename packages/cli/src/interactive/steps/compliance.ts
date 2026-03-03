import * as p from '@clack/prompts';

import type {
  ComplianceConfig,
  ComplianceHook,
  ComplianceModuleSelection,
} from '@openzeppelin/rwa-config';

import type { ComplianceModuleInfo } from '../../generators/registry';

function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Wizard cancelled.');
    process.exit(0);
  }
}

export async function complianceStep(
  availableModules: ComplianceModuleInfo[]
): Promise<ComplianceConfig> {
  p.log.step('Step 3/5 — Compliance Modules');

  if (availableModules.length === 0) {
    p.log.info('No compliance modules available for this chain.');
    return { modules: [] };
  }

  const selected = await p.multiselect({
    message: 'Select compliance modules (space to toggle, enter to confirm)',
    options: availableModules.map((m) => ({
      value: m.id,
      label: m.name,
      hint: `${m.description} (hooks: ${m.supportedHooks.join(', ')})`,
    })),
    required: false,
  });
  handleCancel(selected);

  const selectedIds = selected as string[];
  if (selectedIds.length === 0) {
    return { modules: [] };
  }

  const modules: ComplianceModuleSelection[] = [];
  for (const moduleId of selectedIds) {
    const mod = availableModules.find((m) => m.id === moduleId)!;

    let hook: ComplianceHook;
    if (mod.supportedHooks.length === 1) {
      hook = mod.supportedHooks[0] as ComplianceHook;
      p.log.info(`${mod.name}: auto-assigned to "${hook}" hook`);
    } else {
      const chosen = await p.select({
        message: `${mod.name} — assign to which hook?`,
        options: mod.supportedHooks.map((h) => ({ value: h, label: h })),
      });
      handleCancel(chosen);
      hook = chosen as ComplianceHook;
    }

    modules.push({ moduleId, hook });
  }

  return { modules };
}
