// Public surface of the provenance capability. Internal helpers
// (`openConfigRecorder`, `matchesConfigPathSegments`, key predicates) stay
// module-private to the folder.

export { PROVENANCE_ENTRY_KINDS, ROOT_CONFIG_PATH } from './types';
export type {
  ConfigPath,
  ConfigPathSegment,
  FileProvenance,
  Observed,
  ProvenanceEntry,
  ProvenanceEntryKind,
  ProvenanceLineRange,
  ProvenanceResult,
} from './types';

export {
  ProvenanceAttributionError,
  ProvenanceScopeError,
  ProvenanceViewMutationError,
} from './errors';
export type {
  ProvenanceAttributionErrorReason,
  ProvenanceScopeErrorReason,
  ProvenanceViewMutation,
} from './errors';

export { formatConfigPath, matchesConfigPath, parseConfigPath } from './config-path';

export { omitExactConfigPath } from './omit-config-path';

export { CONFIG_RECORDER_PROBE_KEYS, createConfigRecorder } from './config-recorder';
export type { ConfigRecorder } from './config-recorder';

export { createProvenanceCollector } from './provenance-collector';
export type {
  AddRangeOptions,
  ProvenanceCollector,
  ProvenanceCollectorOptions,
  ProvenanceScope,
  RecordOptions,
} from './provenance-collector';

export {
  filterProvenanceByPath,
  hasProvenance,
  isProvenanceEntry,
  isSecondaryAttribution,
  mergeProvenance,
} from './provenance-result';
export type { ProvenanceGenerationResult } from './provenance-result';

export { createLineBuilder } from './line-builder';
export type { EmitOptions, LineBuilder, LineBuilderOptions, LineSink } from './line-builder';

export { createPatchBuilder } from './patch-builder';
export type { PatchBuilder, PatchSink } from './patch-builder';
