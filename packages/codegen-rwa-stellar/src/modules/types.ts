import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { StellarComplianceHook } from '../ecosystem-metadata';

// ---------------------------------------------------------------------------
// Review-state metadata
// ---------------------------------------------------------------------------

export type ModuleReviewState = 'stable' | 'under-review';

export interface ModuleReviewMeta {
  state: ModuleReviewState;
  prUrl?: string;
}

// ---------------------------------------------------------------------------
// Config field descriptor for module-specific parameters
// ---------------------------------------------------------------------------

/**
 * Structural descriptor for a configurable module parameter. `label` and
 * `placeholder` are kept on the codegen descriptor because they are tightly
 * coupled to the form schema generated from it (label = form label, not
 * explanatory prose). Longer helper text lives in
 * `@openzeppelin/rwa-wizard-copy` under
 * `moduleField.<moduleId>.<fieldKey>` and is joined by the wizard app.
 */
export interface ModuleConfigField {
  key: string;
  label: string;
  type: 'number' | 'string' | 'string[]';
  required: boolean;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Public registry entry
// ---------------------------------------------------------------------------

/**
 * Structural facts about a compliance module. Educational copy
 * (`description`, tooltip prose, field hints) lives in the
 * `@openzeppelin/rwa-wizard-copy` package keyed on `module.<id>` and
 * `moduleField.<id>.<key>`; downstream CLI / programmatic consumers of this
 * codegen package do not ship UI prose they do not need.
 */
export interface ComplianceModuleRegistryEntry {
  id: string;
  name: string;
  requiredHooks: StellarComplianceHook[];
  /** Crate name used in generated Cargo.toml / wasm filenames */
  crateName: string;
  review: ModuleReviewMeta;
  configFields: ModuleConfigField[];
}

// ---------------------------------------------------------------------------
// Internal deployment descriptor
// ---------------------------------------------------------------------------

export interface ModuleInvocation {
  functionName: string;
  args: string;
}

export type ComplianceModuleSelection = RWAConfig['compliance']['modules'][number];

/**
 * Keep module-specific deployment behavior co-located with each descriptor.
 * If modules later need custom deploy args, verification, or docs, extend this
 * contract instead of reintroducing central switch helpers elsewhere.
 */
export interface ComplianceModuleDeploymentDescriptor {
  requiresIdentityRegistryStorage: boolean;
  getConfigurationInvocations(selection: ComplianceModuleSelection): ModuleInvocation[];
  getPostRegistrationInvocations?(selection: ComplianceModuleSelection): ModuleInvocation[];
}

export interface ComplianceModuleDescriptor extends ComplianceModuleRegistryEntry {
  deployment: ComplianceModuleDeploymentDescriptor;
}
