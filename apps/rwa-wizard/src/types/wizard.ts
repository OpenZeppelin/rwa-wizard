import type { RWAConfig } from '@openzeppelin/rwa-config';

/** Re-export canonical config for wizard and codegen boundaries. */
export type { RWAConfig } from '@openzeppelin/rwa-config';

// ---------------------------------------------------------------------------
// Wizard steps (data-model WizardStepId)
// ---------------------------------------------------------------------------

export type WizardStepId =
  | 'asset'
  | 'identity'
  | 'compliance'
  | 'access-control'
  | 'deployment'
  | 'review';

// ---------------------------------------------------------------------------
// Draft lifecycle
// ---------------------------------------------------------------------------

export type WizardDraftStatus = 'draft' | 'ready' | 'generating' | 'generated' | 'error';

export type DraftImportSource = 'manual' | 'imported' | 'template';

export interface WizardDraftMetadata {
  isManuallyRenamed: boolean;
  importSource: DraftImportSource;
  schemaVersion: string;
  lastOpenedAt?: Date;
}

export interface WizardDraftRecord {
  id: string;
  title: string;
  targetId: string;
  status: WizardDraftStatus;
  currentStep: WizardStepId;
  config: RWAConfig;
  metadata: WizardDraftMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftListItem {
  id: string;
  title: string;
  targetId: string;
  status: WizardDraftStatus;
  symbol?: string;
  updatedAt: Date;
}

export interface CreateDraftInput {
  title: string;
  targetId: string;
  config: RWAConfig;
  metadata: Omit<WizardDraftMetadata, 'schemaVersion'> & { schemaVersion?: string };
  currentStep?: WizardStepId;
}

export type SaveDraftPatch = Partial<
  Pick<WizardDraftRecord, 'title' | 'status' | 'currentStep' | 'config' | 'metadata'>
>;

// ---------------------------------------------------------------------------
// Target catalog (contract: TargetCatalogEntry, TargetCapabilitySnapshot)
// ---------------------------------------------------------------------------

export interface TargetCatalogEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  showInUI: boolean;
  disabledLabel?: string;
  disabledDescription?: string;
  packageName: string;
}

export type ModuleReviewState = 'stable' | 'under-review';

export interface ModuleReviewInfo {
  state: ModuleReviewState;
  prUrl?: string;
}

export interface ModuleConfigFieldMeta {
  key: string;
  label: string;
  type: 'number' | 'string' | 'string[]';
  required: boolean;
  placeholder?: string;
  hint?: string;
}

export type ComplianceModuleOption = {
  id: string;
  name: string;
  description: string;
  requiredHooks: string[];
  review: ModuleReviewInfo;
  configFields: ModuleConfigFieldMeta[];
};

export interface FeatureControlMeta {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  defaultValue: boolean;
}

export interface OperatorRoleMeta {
  id: string;
  name: string;
  description: string;
}

export interface ComplianceHookMeta {
  hook: string;
  displayName: string;
  description: string;
}

export interface TargetEcosystemMetadata {
  administrativeControls: readonly FeatureControlMeta[];
  identityControls: readonly FeatureControlMeta[];
  operatorRoles: readonly OperatorRoleMeta[];
  complianceHooks: readonly ComplianceHookMeta[];
  limits: {
    maxModulesPerHook: number;
    maxTrustedIssuers: number;
  };
}

export interface TargetNetworkOption {
  value: string;
  label: string;
  hint?: string;
}

export interface TargetCapabilitySnapshot {
  targetId: string;
  availableModules: ComplianceModuleOption[];
  ecosystemMetadata: TargetEcosystemMetadata;
  networkOptions?: TargetNetworkOption[];
}

// ---------------------------------------------------------------------------
// Codegen / generation (data-model GenerationJobState, contract DTOs)
// ---------------------------------------------------------------------------

export type GenerationPhase =
  | 'idle'
  | 'validating'
  | 'generating'
  | 'packaging'
  | 'success'
  | 'error';

export interface GenerationJobState {
  draftId: string;
  phase: GenerationPhase;
  /** Ordered list of every phase the run has passed through (including current). */
  phaseLog: GenerationPhase[];
  startedAt?: Date;
  completedAt?: Date;
  zipFileName?: string;
  errorMessage?: string;
}

export interface GenerationStatus {
  phase: 'validating' | 'generating' | 'packaging' | 'success' | 'error';
  message?: string;
}

export interface GeneratedZipArtifact {
  fileName: string;
  data: Blob;
}

// ---------------------------------------------------------------------------
// Component inventory (US3)
// ---------------------------------------------------------------------------

export interface ComponentInventoryItem {
  componentName: string;
  owningFile: string;
  classification: 'reused' | 'local-candidate' | 'promoted-shared';
  rationale: string;
  followUpAction?: string;
}
