import type { ProvenanceScope } from '@openzeppelin/codegen-core';
import { createProvenanceCollector } from '@openzeppelin/codegen-core';

/**
 * Run a scope-aware template outside a generation call, recording nothing.
 *
 * This exists so a scoped template has exactly ONE implementation (INV-30).
 * Callers that want plain text — the package's own template unit tests, and any
 * consumer holding a pre-migration signature — go through the same code the
 * generator runs, with a disabled collector. A disabled collector hands the
 * template the raw config and records nothing, and recording never changes a
 * byte (INV-13), so the text is identical either way.
 */
export function renderDetached<T extends object>(
  config: T,
  filePath: string,
  produce: (scope: ProvenanceScope<T>) => string
): string {
  return createProvenanceCollector(config, { enabled: false }).record(filePath, produce);
}
