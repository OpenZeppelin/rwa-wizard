import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { StructuralComplianceModuleOption } from '../../types/wizard';
import {
  isMissingPreviewValue,
  PREVIEW_NUMBER_VALUE,
  PREVIEW_OWNER_ADDRESS,
  PREVIEW_STRING_ARRAY_VALUE,
  PREVIEW_STRING_VALUE,
  PREVIEW_TOKEN_NAME,
  PREVIEW_TOKEN_SYMBOL,
} from './placeholders';

/**
 * Result of a preview fill. `config` is safe to pass to generate / generateZip
 * for missing-required failures the shim knows how to cover. It is not a draft
 * and must not be written back to wizard state.
 */
export interface PreviewConfigResult {
  /** Filled clone, or the original object when nothing was substituted. */
  readonly config: RWAConfig;
  /**
   * Dotted paths matching codegen validation field ids, in walk order.
   * Empty when the input already had every fillable required field set.
   */
  readonly substitutedKeys: readonly string[];
}

/** Catalog slice the shim needs. Same shape `getAvailableModules()` already returns. */
export type PreviewModuleCatalog = readonly StructuralComplianceModuleOption[];

/**
 * Return a generate-ready config for live preview without touching the draft.
 *
 * Fills only missing required values: token name, token symbol, the active
 * ownership address, and required `configFields` on ticked modules. Does not
 * throw. Unknown module ids and invalid-but-present values are left alone.
 */
export function toPreviewConfig(
  config: RWAConfig,
  modules: PreviewModuleCatalog
): PreviewConfigResult {
  let working: RWAConfig = config;
  let cloned = false;
  const substitutedKeys: string[] = [];

  const writable = (): RWAConfig => {
    // INV-3 / INV-14: clone at most once, and only when a fill will run.
    if (!cloned) {
      working = structuredClone(config);
      cloned = true;
    }
    return working;
  };

  // INV-2 / INV-6: walk order is token name, token symbol, active ownership, then modules.
  if (isMissingPreviewValue(working.token.name)) {
    writable().token.name = PREVIEW_TOKEN_NAME; // INV-7
    substitutedKeys.push('token.name');
  }

  if (isMissingPreviewValue(working.token.symbol)) {
    writable().token.symbol = PREVIEW_TOKEN_SYMBOL; // INV-7
    substitutedKeys.push('token.symbol');
  }

  fillActiveOwnershipAddress(working, writable, substitutedKeys);

  const catalogById = indexCatalogById(modules);
  const selections = working.compliance.modules;
  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i];
    if (selection === undefined) {
      continue;
    }

    // INV-8: empty catalog or unknown id skips module fills; no throw (INV-9).
    const option = catalogById.get(selection.moduleId);
    if (option === undefined) {
      continue;
    }

    for (const field of option.configFields) {
      if (!field.required) {
        continue;
      }

      const current = selection.config?.[field.key];
      if (!isMissingPreviewValue(current)) {
        continue; // INV-5 / INV-10: present (including 0 and invalid strings) stays
      }

      const sentinel = sentinelForRequiredField(field.type);
      if (sentinel === undefined) {
        continue;
      }

      const cloneSelection = writable().compliance.modules[i];
      if (cloneSelection === undefined) {
        continue;
      }
      if (cloneSelection.config === undefined) {
        cloneSelection.config = {};
      }
      cloneSelection.config[field.key] = sentinel; // INV-7
      substitutedKeys.push(`compliance.modules[${i}].config.${field.key}`); // INV-2
    }
  }

  // INV-1 / INV-3: same reference when idle.
  return { config: working, substitutedKeys };
}

function fillActiveOwnershipAddress(
  working: RWAConfig,
  writable: () => RWAConfig,
  substitutedKeys: string[]
): void {
  const ownership = working.accessControl.ownership;

  if (ownership.type === 'single-owner') {
    if (isMissingPreviewValue(ownership.ownerAddress)) {
      const next = writable().accessControl.ownership;
      if (next.type === 'single-owner') {
        next.ownerAddress = PREVIEW_OWNER_ADDRESS; // INV-7 / INV-15
        substitutedKeys.push('accessControl.ownership.ownerAddress');
      }
    }
    return;
  }

  if (ownership.type === 'multi-sig' || ownership.type === 'dao') {
    if (isMissingPreviewValue(ownership.address)) {
      const next = writable().accessControl.ownership;
      if (next.type === 'multi-sig' || next.type === 'dao') {
        next.address = PREVIEW_OWNER_ADDRESS; // INV-7 / INV-15
        substitutedKeys.push('accessControl.ownership.address');
      }
    }
  }
}

function indexCatalogById(
  modules: PreviewModuleCatalog
): Map<string, StructuralComplianceModuleOption> {
  const catalogById = new Map<string, StructuralComplianceModuleOption>();
  for (const option of modules) {
    if (!catalogById.has(option.id)) {
      catalogById.set(option.id, option);
    }
  }
  return catalogById;
}

function sentinelForRequiredField(
  type: StructuralComplianceModuleOption['configFields'][number]['type']
): number | string | string[] | undefined {
  switch (type) {
    case 'number':
      return PREVIEW_NUMBER_VALUE;
    case 'string':
      return PREVIEW_STRING_VALUE;
    case 'string[]':
      return [...PREVIEW_STRING_ARRAY_VALUE];
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return undefined;
    }
  }
}
