import * as p from '@clack/prompts';

import type { ComplianceConfig, ComplianceModuleSelection } from '@openzeppelin/rwa-config';

import type { ComplianceModuleInfo } from '../../generators/registry';
import { parseCommaSeparatedList } from '../../utils/comma-list';
import { handleWizardCancel } from '../utils';

function hookList(entry: ComplianceModuleInfo): string {
  return entry.requiredHooks.join(', ');
}

export async function complianceStep(
  availableModules: ComplianceModuleInfo[]
): Promise<ComplianceConfig> {
  p.log.step('Step 3/6 — Compliance Modules');

  if (availableModules.length === 0) {
    p.log.info('No compliance modules available for this chain.');
    return { modules: [] };
  }

  const selected = await p.multiselect({
    message: 'Select compliance modules (space to toggle, enter to confirm)',
    options: availableModules.map((m) => ({
      value: m.id,
      label: m.name,
      hint: `${m.description ? `${m.description} ` : ''}(hooks: ${hookList(m)})${m.review.state === 'under-review' ? ' ⚠ under review' : ''}`,
    })),
    required: false,
  });
  handleWizardCancel(selected);

  const selectedIds = selected as string[];
  if (selectedIds.length === 0) {
    return { modules: [] };
  }

  const modules: ComplianceModuleSelection[] = [];
  for (const moduleId of selectedIds) {
    const entry = availableModules.find((m) => m.id === moduleId)!;

    p.log.info(`${entry.name}: auto-registered on hooks: ${hookList(entry)}`);

    if (entry.review.state === 'under-review') {
      p.log.warn(
        `⚠  "${entry.name}" is under review${entry.review.prUrl ? ` — ${entry.review.prUrl}` : ''}`
      );
    }

    const config: Record<string, unknown> = {};
    for (const field of entry.configFields) {
      if (field.type === 'number') {
        const val = await p.text({
          message: `${entry.name} — ${field.label}`,
          placeholder: field.placeholder,
          validate: (input) => {
            const t = input.trim();
            if (field.required && !t) return `${field.label} is required`;
            if (t && !Number.isFinite(Number(t))) return 'Must be a finite number';
            return undefined;
          },
        });
        handleWizardCancel(val);
        const strVal = (val as string).trim();
        if (strVal) config[field.key] = Number(strVal);
      } else if (field.type === 'string[]') {
        const val = await p.text({
          message: `${entry.name} — ${field.label} (comma-separated)`,
          placeholder: field.placeholder,
          validate: (input) => {
            if (field.required && parseCommaSeparatedList(input).length === 0) {
              return `${field.label} is required`;
            }
            return undefined;
          },
        });
        handleWizardCancel(val);
        const strVal = (val as string).trim();
        if (strVal) {
          config[field.key] = parseCommaSeparatedList(strVal);
        }
      } else {
        const val = await p.text({
          message: `${entry.name} — ${field.label}`,
          placeholder: field.placeholder,
          validate: (input) => {
            if (field.required && !input.trim()) return `${field.label} is required`;
            return undefined;
          },
        });
        handleWizardCancel(val);
        const strVal = (val as string).trim();
        if (strVal) config[field.key] = strVal;
      }
    }

    modules.push({
      moduleId,
      config: Object.keys(config).length > 0 ? config : undefined,
    });
  }

  return { modules };
}
