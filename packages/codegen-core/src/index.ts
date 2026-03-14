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

// ZIP generation
export { generateZipFromFileTree } from './zip-generator';

// Generation pipeline
export { generateZip } from './generator';
