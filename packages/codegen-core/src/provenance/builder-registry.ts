/**
 * The one-builder-per-scope claim and the pending/observe state machine both
 * builders share.
 *
 * The claim registry is the only module-level value in the builder modules: a
 * `WeakSet` that retains nothing, cannot be enumerated, and changes no output.
 * Its sole effect is rejecting a second builder on the same scope.
 */
import { ProvenanceAttributionError } from './errors';
import type { ProvenanceScope } from './provenance-collector';
import type { ConfigPath, Observed } from './types';

/** Claimed scopes. Weak: an entry vanishes with its scope. */
const claimedScopes = new WeakSet<object>();

export interface AttributionCursor<T extends object> {
  /**
   * The paths of the next emission: `scope.drain()` ∪ pending ∪ `extraPaths`,
   * sorted and deduplicated, with pending cleared. Nothing is pruned, filtered
   * or invented — every string handed in comes back out.
   */
  take(extraPaths?: readonly ConfigPath[]): ConfigPath[];
  /** Move the current window (and any explicit paths) to pending: they shape whatever comes next. */
  flush(extraPaths?: readonly ConfigPath[]): void;
  /**
   * Run `compute` under the scope's recording view and return its value with
   * exactly the paths it read. Reads made since the previous emission stay
   * pending for the next one rather than being attributed here.
   */
  observe<R>(compute: (config: T) => R): Observed<R>;
}

/**
 * Claim `scope` for one builder and open its attribution cursor.
 *
 * Throws `ProvenanceAttributionError('builder-exists')` when the scope already
 * has a builder, and `ProvenanceAttributionError('reads-before-builder')` when
 * anything was read through the scope before this call — the builder must be
 * the first thing that touches its scope, or the reads it cannot see would be
 * attributed to whatever it emits first.
 *
 * A failed guard claims nothing: a correctly placed builder can still bind.
 */
export function bindScope<T extends object>(scope: ProvenanceScope<T>): AttributionCursor<T> {
  // INV-20: checked before the drain, so a rejected second claim consumes no window.
  if (claimedScopes.has(scope)) {
    throw new ProvenanceAttributionError('builder-exists', scope.filePath);
  }
  // INV-11: the construction drain guard.
  const readTooEarly = scope.drain();
  if (readTooEarly.length > 0) {
    throw new ProvenanceAttributionError('reads-before-builder', scope.filePath, readTooEarly);
  }
  claimedScopes.add(scope);

  const pending = new Set<ConfigPath>();

  return {
    take(extraPaths) {
      // INV-5, INV-6: union of the three sources, verbatim.
      const union = new Set<ConfigPath>(scope.drain());
      pending.forEach((path) => union.add(path));
      if (extraPaths !== undefined) extraPaths.forEach((path) => union.add(path));
      pending.clear();
      return [...union].sort();
    },
    flush(extraPaths) {
      // INV-22 / Open Q1: a zero-line emission loses nothing, explicit paths included.
      scope.drain().forEach((path) => pending.add(path));
      if (extraPaths !== undefined) extraPaths.forEach((path) => pending.add(path));
    },
    observe(compute) {
      // INV-8: stash the pre-compute window, then report only what `compute` read.
      scope.drain().forEach((path) => pending.add(path));
      let value: ReturnType<typeof compute>;
      try {
        value = compute(scope.config);
      } catch (error) {
        // A throwing compute shaped no bytes. Its partial reads must not stay in
        // the recorder window, where a template that catches would attribute
        // them to whatever it emits next.
        scope.drain();
        throw error;
      }
      return { value, paths: scope.drain() };
    },
  };
}
