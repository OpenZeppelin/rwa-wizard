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

export interface ModuleConfigField {
  key: string;
  label: string;
  type: 'number' | 'string' | 'string[]';
  required: boolean;
  placeholder?: string;
  hint?: string;
}

// ---------------------------------------------------------------------------
// Public registry entry
// ---------------------------------------------------------------------------

export interface ComplianceModuleRegistryEntry {
  id: string;
  name: string;
  description: string;
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
}

export interface ComplianceModuleDescriptor extends ComplianceModuleRegistryEntry {
  deployment: ComplianceModuleDeploymentDescriptor;
}
