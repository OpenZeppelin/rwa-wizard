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

// ZIP generation
export { generateZipFromFileTree } from './zip-generator';

// Generation pipeline
export { generateZip } from './generator';
