import type {
  ComplianceModuleCategoryId,
  ComplianceModuleConfigValueKind,
  ComplianceModuleRuntimePrerequisiteId,
  ComplianceModuleSelectionWarningId,
  ComplianceModuleSelectionWarningRule,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';
import { CHAIN_IDS, isChainId, type ChainId } from '@openzeppelin/rwa-wizard-copy';

/** Re-export canonical config for wizard and codegen boundaries. */
export type { RWAConfig } from '@openzeppelin/rwa-config';

// ---------------------------------------------------------------------------
// Target identifiers
// ---------------------------------------------------------------------------

/**
 * Ordered tuple of known target ids. Re-exported from
 * {@link CHAIN_IDS} so the copy package stays the single source of truth for
 * which chain families the wizard supports.
 */
export const TARGET_IDS = CHAIN_IDS;

/**
 * Canonical target id type for every in-memory boundary in the app (store,
 * props, React state). Aliased to {@link ChainId} so type errors surface
 * immediately when a new chain is added without an explicit wizard
 * acknowledgement.
 *
 * Persisted fields (e.g. {@link WizardDraftRecord.targetId},
 * {@link TargetCatalogEntry.id}) stay typed as `string` on purpose: drafts
 * written today must survive future target additions, and boundary DTOs
 * should accept unknown ids without widening the runtime surface.
 */
export type TargetId = ChainId;

/** Narrow an arbitrary string to a known {@link TargetId}. */
export function isTargetId(value: string): value is TargetId {
  return isChainId(value);
}

// ---------------------------------------------------------------------------
// Wizard steps (data-model WizardStepId)
// ---------------------------------------------------------------------------

/**
 * Canonical ordered list of wizard step ids.
 *
 * This is the single source of truth for wizard steps: the {@link WizardStepId}
 * type is derived from this tuple, and runtime validators (e.g. import
 * sanitization) iterate over it. Adding or removing a step is a one-line
 * change here that the typechecker will propagate across the codebase.
 */
export const WIZARD_STEP_IDS = [
  'asset',
  'identity',
  'compliance',
  'access-control',
  'deployment',
  'review',
] as const;

export type WizardStepId = (typeof WIZARD_STEP_IDS)[number];

// ---------------------------------------------------------------------------
// Draft lifecycle
// ---------------------------------------------------------------------------

/**
 * Canonical list of wizard draft statuses.
 * See {@link WIZARD_STEP_IDS} for the rationale behind the tuple-as-truth pattern.
 */
export const WIZARD_DRAFT_STATUSES = [
  'draft',
  'ready',
  'generating',
  'generated',
  'error',
] as const;

export type WizardDraftStatus = (typeof WIZARD_DRAFT_STATUSES)[number];

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

/**
 * Structural descriptor for a module's configurable parameter as emitted by
 * the codegen package. Helper text (`hint`) is joined in the app layer from
 * `@openzeppelin/rwa-wizard-copy` keyed on
 * `moduleField.<moduleId>.<fieldKey>`.
 */
export interface StructuralModuleConfigFieldMeta {
  key: string;
  label: string;
  type: 'number' | 'string' | 'string[]';
  required: boolean;
  placeholder?: string;
  valueKind?: ComplianceModuleConfigValueKind;
}

/** UI-ready config field metadata: structural fields + joined helper text. */
export interface ModuleConfigFieldMeta extends StructuralModuleConfigFieldMeta {
  hint?: string;
}

export interface ComplianceModuleRuntimePrerequisiteMeta {
  id: ComplianceModuleRuntimePrerequisiteId;
  label: string;
  infoCopy?: string;
}

export interface ComplianceModuleCategoryGroupMeta {
  id: ComplianceModuleCategoryId;
  title: string;
  description: string;
}

export interface ComplianceModuleSelectionWarningMeta {
  id: ComplianceModuleSelectionWarningId;
  description: string;
  relatedModuleIds: readonly string[];
  /** When true, the warning blocks wizard progression until resolved. */
  blocking?: boolean;
}

/**
 * Structural compliance-module entry as emitted by the codegen package.
 * Copy (description, info tooltip) lives in `@openzeppelin/rwa-wizard-copy`.
 */
export interface StructuralComplianceModuleOption {
  id: string;
  name: string;
  category: ComplianceModuleCategoryId;
  runtimePrerequisites: readonly ComplianceModuleRuntimePrerequisiteId[];
  requiredHooks: string[];
  review: ModuleReviewInfo;
  configFields: StructuralModuleConfigFieldMeta[];
}

/**
 * UI-ready compliance-module entry: structural facts plus educational copy
 * joined from the copy package.
 */
export interface ComplianceModuleOption extends Omit<
  StructuralComplianceModuleOption,
  'runtimePrerequisites' | 'configFields'
> {
  description: string;
  /** Longer tooltip copy. Omitted when no `infoCopy` entry is defined. */
  infoCopy?: string;
  runtimePrerequisites: ComplianceModuleRuntimePrerequisiteMeta[];
  configFields: ModuleConfigFieldMeta[];
}

/**
 * Structural facts about a feature control emitted by a codegen package.
 * Copy (description, tooltip prose) is joined in the app layer from
 * `@openzeppelin/rwa-wizard-copy` — see `registry/enrichEcosystemMetadata.ts`.
 */
export interface StructuralFeatureControlMeta {
  id: string;
  name: string;
  locked: boolean;
  defaultValue: boolean;
}

/**
 * UI-ready feature control metadata: the structural facts plus joined copy.
 * This is what step components receive and render.
 */
export interface FeatureControlMeta extends StructuralFeatureControlMeta {
  /** Short one-line label shown beneath the title. */
  description: string;
  /**
   * Longer educational copy surfaced behind an info-icon tooltip. When
   * absent, the tooltip (and its icon) is suppressed — we never duplicate
   * `description` just to have something to show.
   */
  infoCopy?: string;
}

/**
 * Structural operator-role descriptor emitted by a codegen package.
 * Copy (description, info tooltip) is joined in the app layer from
 * `@openzeppelin/rwa-wizard-copy` keyed on `role.<id>`.
 */
export interface StructuralOperatorRoleMeta {
  id: string;
  name: string;
}

/** UI-ready operator role: structural fields plus joined educational copy. */
export interface OperatorRoleMeta extends StructuralOperatorRoleMeta {
  description: string;
  infoCopy?: string;
}

/**
 * Structural compliance-hook descriptor emitted by a codegen package.
 * Copy (description, info tooltip) is joined in the app layer from
 * `@openzeppelin/rwa-wizard-copy` keyed on `hook.<hook>`.
 */
export interface StructuralComplianceHookMeta {
  hook: string;
  displayName: string;
}

/** UI-ready compliance hook: structural fields plus joined educational copy. */
export interface ComplianceHookMeta extends StructuralComplianceHookMeta {
  description: string;
  infoCopy?: string;
}

export interface ComplianceCatalogMetadata {
  moduleCategories: readonly ComplianceModuleCategoryId[];
  selectionWarningRules: readonly ComplianceModuleSelectionWarningRule[];
}

/**
 * Structural metadata emitted by codegen packages. Roles, hooks, and control
 * descriptors only carry structural labels; user-facing prose lives in
 * `@openzeppelin/rwa-wizard-copy` and is joined in the app layer.
 */
export interface StructuralEcosystemMetadata {
  administrativeControls: readonly StructuralFeatureControlMeta[];
  identityControls: readonly StructuralFeatureControlMeta[];
  operatorRoles: readonly StructuralOperatorRoleMeta[];
  complianceHooks: readonly StructuralComplianceHookMeta[];
  complianceCatalog: ComplianceCatalogMetadata;
  limits: {
    maxModulesPerHook: number;
    maxTrustedIssuers: number;
  };
}

/**
 * UI-ready ecosystem metadata — structural data joined with chain-appropriate
 * educational copy. Produced by `enrichEcosystemMetadata` and consumed by
 * step components.
 */
export interface TargetEcosystemMetadata {
  administrativeControls: readonly FeatureControlMeta[];
  identityControls: readonly FeatureControlMeta[];
  operatorRoles: readonly OperatorRoleMeta[];
  complianceHooks: readonly ComplianceHookMeta[];
  complianceCatalog: ComplianceCatalogMetadata;
  limits: StructuralEcosystemMetadata['limits'];
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
