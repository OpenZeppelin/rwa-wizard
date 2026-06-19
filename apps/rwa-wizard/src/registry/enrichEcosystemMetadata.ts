import type {
  ComplianceModuleCategoryId,
  ComplianceModuleSelectionWarning,
} from '@openzeppelin/codegen-rwa-common';
import { getCopyForChain, isChainId, type ChainCopy } from '@openzeppelin/rwa-wizard-copy';

import type {
  ComplianceHookMeta,
  ComplianceModuleCategoryGroupMeta,
  ComplianceModuleOption,
  ComplianceModuleSelectionWarningMeta,
  FeatureControlMeta,
  ModuleConfigFieldMeta,
  OperatorRoleMeta,
  StructuralComplianceHookMeta,
  StructuralComplianceModuleOption,
  StructuralEcosystemMetadata,
  StructuralFeatureControlMeta,
  StructuralOperatorRoleMeta,
  TargetEcosystemMetadata,
} from '../types/wizard';

/**
 * Joins structural codegen metadata with the chain-appropriate copy dictionary
 * and produces the enriched `TargetEcosystemMetadata` the wizard UI renders.
 *
 * This is the single seam where the two packages meet — keeping the join
 * here (rather than inside each step component) means the lookup happens
 * once per target-load, not per render.
 */
export function enrichEcosystemMetadata(
  targetId: string,
  structural: StructuralEcosystemMetadata
): TargetEcosystemMetadata {
  if (!isChainId(targetId)) {
    return {
      ...structural,
      administrativeControls: structural.administrativeControls.map(toPlaceholderControl),
      identityControls: structural.identityControls.map(toPlaceholderControl),
      operatorRoles: structural.operatorRoles.map(toPlaceholderRole),
      complianceHooks: structural.complianceHooks.map(toPlaceholderHook),
      complianceCatalog: structural.complianceCatalog,
    };
  }

  const copy = getCopyForChain(targetId);

  return {
    ...structural,
    administrativeControls: structural.administrativeControls.map((meta) =>
      enrichControl(meta, copy.adminControl(meta.id))
    ),
    identityControls: structural.identityControls.map((meta) =>
      enrichControl(meta, copy.identityControl(meta.id))
    ),
    operatorRoles: structural.operatorRoles.map((role) => enrichRole(role, copy.role(role.id))),
    complianceHooks: structural.complianceHooks.map((meta) =>
      enrichHook(meta, copy.hook(meta.hook))
    ),
  };
}

/**
 * Joins structural compliance-module descriptors with module-level and
 * field-level copy. Separate from `enrichEcosystemMetadata` because modules
 * are loaded through a different service call (`getAvailableModules`).
 */
export function enrichAvailableModules(
  targetId: string,
  structural: readonly StructuralComplianceModuleOption[]
): ComplianceModuleOption[] {
  if (!isChainId(targetId)) {
    return structural.map(toPlaceholderModule);
  }
  const copy = getCopyForChain(targetId);
  return structural.map((mod) => enrichModule(mod, copy));
}

// ---------------------------------------------------------------------------
// Per-entry join helpers
// ---------------------------------------------------------------------------

function enrichControl(
  meta: StructuralFeatureControlMeta,
  entry: { description: string; infoCopy?: string }
): FeatureControlMeta {
  return { ...meta, description: entry.description, infoCopy: entry.infoCopy };
}

function enrichRole(
  role: StructuralOperatorRoleMeta,
  entry: { description: string; infoCopy?: string }
): OperatorRoleMeta {
  return { ...role, description: entry.description, infoCopy: entry.infoCopy };
}

function enrichHook(
  meta: StructuralComplianceHookMeta,
  entry: { description: string; infoCopy?: string }
): ComplianceHookMeta {
  return { ...meta, description: entry.description, infoCopy: entry.infoCopy };
}

function enrichModule(
  mod: StructuralComplianceModuleOption,
  copy: ChainCopy
): ComplianceModuleOption {
  const moduleEntry = copy.module(mod.id);
  return {
    ...mod,
    description: moduleEntry.description,
    infoCopy: moduleEntry.infoCopy,
    runtimePrerequisites: mod.runtimePrerequisites.map((id) => {
      const entry = copy.notice(`compliance.module-prerequisite.${id}`);
      return {
        id,
        label: entry.description,
        infoCopy: entry.infoCopy,
      };
    }),
    configFields: mod.configFields.map((field): ModuleConfigFieldMeta => {
      const fieldEntry = copy.moduleField(mod.id, field.key);
      return { ...field, hint: fieldEntry.description || undefined };
    }),
  };
}

export function enrichComplianceModuleCategoryGroup(
  targetId: string,
  category: ComplianceModuleCategoryId
): ComplianceModuleCategoryGroupMeta | null {
  if (!isChainId(targetId)) return null;
  const copy = getCopyForChain(targetId);
  const entry = copy.notice(`compliance.module-category.${category}`);
  return {
    id: category,
    title: entry.title ?? category,
    description: entry.description,
  };
}

export function enrichComplianceSelectionWarning(
  targetId: string,
  warning: ComplianceModuleSelectionWarning
): ComplianceModuleSelectionWarningMeta | null {
  if (!isChainId(targetId)) return null;
  const copy = getCopyForChain(targetId);
  const entry = copy.notice(`compliance.selection-warning.${warning.id}`);
  return {
    id: warning.id,
    description: entry.description,
    relatedModuleIds: warning.relatedModuleIds,
  };
}

// ---------------------------------------------------------------------------
// Placeholders for unknown targets (keep render path alive)
// ---------------------------------------------------------------------------

function toPlaceholderControl(meta: StructuralFeatureControlMeta): FeatureControlMeta {
  return { ...meta, description: '' };
}

function toPlaceholderRole(role: StructuralOperatorRoleMeta): OperatorRoleMeta {
  return { ...role, description: '' };
}

function toPlaceholderHook(meta: StructuralComplianceHookMeta): ComplianceHookMeta {
  return { ...meta, description: '' };
}

function toPlaceholderModule(mod: StructuralComplianceModuleOption): ComplianceModuleOption {
  return {
    ...mod,
    description: '',
    runtimePrerequisites: [],
    configFields: mod.configFields.map((field): ModuleConfigFieldMeta => ({ ...field })),
  };
}
