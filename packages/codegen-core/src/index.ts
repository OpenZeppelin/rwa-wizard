// Optional intro copy for generators (CLI, UI, docs)
export type { CodegenInfoBlurb, CodegenInfoLink } from './codegen-info-blurb';

// Types
export type {
  FileTree,
  ValidationError,
  ValidationWarning,
  ValidationResult,
  ProgressEvent,
  ProgressCallback,
  ProgressPhase,
  SummaryPhase,
  GenerateOptions,
  GenerationMetadata,
  GenerationResult,
  ZipResult,
  Generator,
} from './types';
export { PROGRESS_PHASES } from './types';

// Determinism utilities
export { computeConfigHash, hashString, sortObjectKeys, stableJsonStringify } from './determinism';

// Template-source helpers
export {
  assertTemplateSnapshotCompleteness,
  createSnapshotTemplateSource,
  getTemplateSourceKey,
} from './template-source';
export type {
  TemplateManifestEntry,
  TemplatePayload,
  TemplateSnapshot,
  TemplateSnapshotMetadata,
  TemplateSource,
  TemplateSourceKey,
  TemplateSourceMetadata,
} from './template-source';

// Validation framework
export { createValidationRule, composeValidationRules, validateWithRules } from './validation';
export type { ValidationRule, ValidationRuleResult } from './validation';

// File tree utilities
export {
  createFile,
  mergeFileTrees,
  addFile,
  prefixPaths,
  getFilePaths,
  getFileCount,
} from './file-tree';

// Progress utilities
export {
  noopProgress,
  createProgressEvent,
  resolveProgressCallback,
  toSummaryPhase,
} from './progress';
export { CoreProgressPhase } from './progress-phases';
export type { CoreProgressPhaseName } from './progress-phases';

// Source patch helpers
export { insertAfterExact, insertBeforeExact, replaceExact } from './source-patch';

// Generated-file ranking kinds (shared vocabulary for generators and consumers)
export {
  GENERATED_FILE_KINDS,
  PROVENANCE_AND_DOCS_KIND,
  isGeneratedFileKind,
} from './generated-file-kind';
export type { GeneratedFileKind } from './generated-file-kind';

// ZIP generation
export { generateZipFromFileTree } from './zip-generator';

// Generation pipeline
export { generateZip } from './generator';

// Provenance capability (optional on the generator contract)
export {
  CONFIG_RECORDER_PROBE_KEYS,
  PROVENANCE_ENTRY_KINDS,
  ROOT_CONFIG_PATH,
  ProvenanceAttributionError,
  ProvenanceScopeError,
  ProvenanceViewMutationError,
  createConfigRecorder,
  createLineBuilder,
  createPatchBuilder,
  createProvenanceCollector,
  filterProvenanceByPath,
  formatConfigPath,
  hasProvenance,
  isProvenanceEntry,
  isSecondaryAttribution,
  matchesConfigPath,
  mergeProvenance,
  omitExactConfigPath,
  parseConfigPath,
} from './provenance';
export type {
  AddRangeOptions,
  ConfigPath,
  ConfigPathSegment,
  ConfigRecorder,
  EmitOptions,
  FileProvenance,
  LineBuilder,
  LineBuilderOptions,
  LineSink,
  Observed,
  PatchBuilder,
  PatchSink,
  ProvenanceAttributionErrorReason,
  ProvenanceCollector,
  ProvenanceCollectorOptions,
  ProvenanceEntry,
  ProvenanceEntryKind,
  ProvenanceGenerationResult,
  ProvenanceLineRange,
  ProvenanceResult,
  ProvenanceScope,
  ProvenanceScopeErrorReason,
  ProvenanceViewMutation,
  RecordOptions,
} from './provenance';
