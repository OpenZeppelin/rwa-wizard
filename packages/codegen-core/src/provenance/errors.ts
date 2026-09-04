import type { ConfigPath } from './types';

/** The trap a mutation attempt went through. */
export type ProvenanceViewMutation =
  | 'set'
  | 'delete'
  | 'define'
  | 'setPrototype'
  | 'preventExtensions';

/**
 * Thrown by every mutating trap on a recording view. Names the path of
 * the operation's target and the operation — never a value.
 */
export class ProvenanceViewMutationError extends Error {
  readonly code = 'PROVENANCE_VIEW_MUTATION' as const;

  constructor(
    readonly path: ConfigPath,
    readonly operation: ProvenanceViewMutation
  ) {
    super(
      `Cannot ${operation} on a provenance view at path "${path}": the config is read-only while it is being recorded`
    );
    this.name = 'ProvenanceViewMutationError';
  }
}

/**
 * - `nested` — `record`/`createFile` called while another scope is producing.
 * - `closed` — a collector used after `result()`, or a scope's view, `drain` or
 *   `addRange` used after its `produce` returned.
 */
export type ProvenanceScopeErrorReason = 'nested' | 'closed';

/** Thrown on scope-structure misuse. Independent of `enabled`. */
export class ProvenanceScopeError extends Error {
  readonly code = 'PROVENANCE_SCOPE' as const;

  constructor(
    readonly reason: ProvenanceScopeErrorReason,
    readonly filePath?: string
  ) {
    super(describeScopeError(reason, filePath));
    this.name = 'ProvenanceScopeError';
  }
}

function describeScopeError(reason: ProvenanceScopeErrorReason, filePath?: string): string {
  const where = filePath === undefined ? '' : ` (file "${filePath}")`;
  return reason === 'nested'
    ? `Provenance scopes do not nest: record() was called while another scope was producing${where}`
    : `Provenance scope is closed: the collector or scope was used after it finished${where}`;
}

/**
 * - `reads-before-builder` — config was read through the scope before its builder was created.
 * - `builder-exists` — a second builder was bound to a scope that already has one.
 * - `emit-after-text` — an emission, patch or `observe` after `text()` sealed the builder.
 * - `secondary-not-attributed` — `addRange` was given secondary paths the range does not attribute.
 */
export type ProvenanceAttributionErrorReason =
  | 'reads-before-builder'
  | 'builder-exists'
  | 'emit-after-text'
  | 'secondary-not-attributed';

/**
 * Thrown when a builder cannot attribute honestly. Names the reason, the file
 * being produced and — for `reads-before-builder` — the paths read too early.
 * Never a config value and never emitted text.
 */
export class ProvenanceAttributionError extends Error {
  readonly code = 'PROVENANCE_ATTRIBUTION' as const;

  constructor(
    readonly reason: ProvenanceAttributionErrorReason,
    readonly filePath: string,
    readonly paths: readonly ConfigPath[] = []
  ) {
    super(describeAttributionError(reason, filePath, paths));
    this.name = 'ProvenanceAttributionError';
  }
}

function describeAttributionError(
  reason: ProvenanceAttributionErrorReason,
  filePath: string,
  paths: readonly ConfigPath[]
): string {
  switch (reason) {
    case 'reads-before-builder':
      return `Config was read before the builder for "${filePath}" existed: [${paths.join(', ')}]. Create the builder first and compute config-derived values with builder.observe(...).`;
    case 'builder-exists':
      return `A builder is already bound to the provenance scope for "${filePath}": exactly one builder may record a file.`;
    case 'emit-after-text':
      return `The builder for "${filePath}" was sealed by text(): it can no longer emit or attribute.`;
    case 'secondary-not-attributed':
      return `Secondary paths for "${filePath}" are not attributed by the range they mark: [${paths.join(', ')}]. Every secondary path must appear in the range's own paths.`;
  }
}
