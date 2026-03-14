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
  mockCoverage?: string[];
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

export type ComplianceModuleOption = {
  id: string;
  name: string;
  description: string;
  supportedHooks: Array<'transfer' | 'creation' | 'destruction'>;
};

export interface TargetNetworkOption {
  value: string;
  label: string;
  hint?: string;
}

export interface TargetCapabilitySnapshot {
  targetId: string;
  availableModules: ComplianceModuleOption[];
  networkOptions?: TargetNetworkOption[];
  mocked: boolean;
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
  startedAt?: Date;
  completedAt?: Date;
  zipFileName?: string;
  errorMessage?: string;
  usedMock: boolean;
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
// Component inventory (US3) and mock gap register
// ---------------------------------------------------------------------------

export interface ComponentInventoryItem {
  componentName: string;
  owningFile: string;
  classification: 'reused' | 'local-candidate' | 'promoted-shared';
  rationale: string;
  followUpAction?: string;
}

export interface MockGapRecord {
  id: string;
  targetId: string;
  capability: string;
  mockBehavior: string;
  replacementTrigger: string;
  owner?: string;
}
