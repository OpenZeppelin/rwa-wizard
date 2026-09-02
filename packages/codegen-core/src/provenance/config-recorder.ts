import { isCanonicalIndexKey, isRepresentableKey } from './config-path';
import { ProvenanceScopeError, ProvenanceViewMutationError } from './errors';
import type { ProvenanceViewMutation } from './errors';
import { ROOT_CONFIG_PATH } from './types';
import type { ConfigPath } from './types';

/**
 * Keys probed by the runtime that are never a config read: `toJSON` (by
 * `JSON.stringify`) and `then` (by `await` / `Promise.resolve`). Fixed and frozen;
 * not extensible.
 */
export const CONFIG_RECORDER_PROBE_KEYS: ReadonlySet<string> = Object.freeze(
  new Set(['toJSON', 'then'])
);

export interface ConfigRecorder<T extends object> {
  /**
   * The recording view. Typed as `T`; every property access through it is
   * logged. Reads return the original values (primitives, functions and
   * non-plain objects) or a cached child view (plain objects and arrays).
   * Writes, deletes and `defineProperty` throw `ProvenanceViewMutationError`.
   */
  readonly view: T;
  /**
   * Paths read since the previous `drain()` (or since creation). Sorted,
   * deduplicated, and pruned: a path that was only *traversed* in this window
   * on the way to a recorded descendant is dropped; a path read as an object in
   * its own right (`if (v.a)`, `Object.keys(v.a)`, `has`, a leaf read) is kept.
   * Resets the cursor.
   */
  drain(): ConfigPath[];
  /**
   * Every path read since creation, regardless of drains. Sorted, deduplicated,
   * pruned over the whole history — so a traversal reported by an early
   * `drain()` is collapsed here once its leaf was read in a later window.
   */
  all(): ConfigPath[];
}

/**
 * A recorder plus the two operations the collector needs and the public
 * interface does not expose: closing the views when their scope ends
 * and unwrapping a view back to its raw target.
 */
export interface ConfigRecorderHandle<T extends object> {
  readonly recorder: ConfigRecorder<T>;
  /** After this, every read trap on every view of this recorder throws `ProvenanceScopeError('closed', filePath)`. */
  close(filePath?: string): void;
  /**
   * `value` with every view of this recorder replaced by its raw target: a view
   * itself, or views nested anywhere inside plain objects and arrays (a fresh
   * container is built only where something changed). Non-plain objects are
   * returned as they are.
   */
  unwrap<R>(value: R): R;
}

/** Where a string-key access lands: the path to record and, when descent is allowed, the child's path. */
interface KeyResolution {
  readonly record: ConfigPath;
  readonly child: ConfigPath | null;
}

/**
 * How a path was read. A `get` that returns a child view is a *traversal* — a
 * step on the way to something else; every other recording access is *terminal*.
 * Terminal overrides traversal for the same path and is never downgraded.
 */
type ReadKind = 'traversal' | 'terminal';

const hasOwn = (target: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

/** Plain objects (prototype `Object.prototype` or `null`) and arrays are descended into; everything else is returned raw. */
function isDescendable(value: unknown): value is object {
  if (Array.isArray(value)) return true;
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * The noise filter and path rules, in order: array rules first, then
 * inherited-not-own, then the object rule with the unrepresentable-key fallback
 * to the parent path. Probe keys and symbols are handled by the caller. Returns
 * `null` when nothing is recorded.
 */
function resolveKey(real: object, path: ConfigPath, key: string): KeyResolution | null {
  if (Array.isArray(real)) {
    if (!isCanonicalIndexKey(key)) return { record: path, child: null };
    // A path may not start with an index (INV-25); an array root is read as a whole.
    if (path === ROOT_CONFIG_PATH) return { record: path, child: null };
    const child = `${path}[${key}]`;
    return { record: child, child };
  }
  if (key in real && !hasOwn(real, key)) return null;
  if (!isRepresentableKey(key)) return { record: path, child: null };
  const child = path === ROOT_CONFIG_PATH ? key : `${path}.${key}`;
  return { record: child, child };
}

/**
 * Every strict ancestor of `path` at a segment boundary. Keys never contain `.`,
 * `[` or `]` (unrepresentable keys fall back to the parent), so every `.`/`[` is
 * a boundary. The root is excluded: it is only ever recorded terminally.
 */
function strictAncestors(path: ConfigPath): ConfigPath[] {
  const ancestors: ConfigPath[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const ch = path.charAt(i);
    if (ch === '.' || ch === '[') ancestors.push(path.slice(0, i));
  }
  return ancestors;
}

/**
 * The reported form of a recorded set: sorted, and with every traversal path
 * that has a strict segment-boundary descendant in the same set dropped.
 * Terminal paths are never dropped. Linear in total path length.
 */
function report(window: ReadonlyMap<ConfigPath, ReadKind>): ConfigPath[] {
  const hasDescendant = new Set<ConfigPath>();
  for (const path of window.keys()) {
    for (const ancestor of strictAncestors(path)) hasDescendant.add(ancestor);
  }
  const reported: ConfigPath[] = [];
  for (const [path, kind] of window) {
    if (kind === 'terminal' || !hasDescendant.has(path)) reported.push(path);
  }
  return reported.sort();
}

/**
 * Open a recorder over `config` and keep the close/unwrap handle. Internal to
 * the collector; `createConfigRecorder` is the public face.
 */
export function openConfigRecorder<T extends object>(config: T): ConfigRecorderHandle<T> {
  const sinceDrain = new Map<ConfigPath, ReadKind>();
  const allTime = new Map<ConfigPath, ReadKind>();
  const viewsByTarget = new WeakMap<object, object>();
  const targetsByView = new WeakMap<object, object>();
  let closedAs: { readonly filePath?: string } | null = null;

  const classify = (window: Map<ConfigPath, ReadKind>, path: ConfigPath, kind: ReadKind): void => {
    if (window.get(path) !== 'terminal') window.set(path, kind);
  };

  const record = (path: ConfigPath, kind: ReadKind): void => {
    classify(sinceDrain, path, kind);
    classify(allTime, path, kind);
  };

  const assertOpen = (): void => {
    if (closedAs !== null) throw new ProvenanceScopeError('closed', closedAs.filePath); // INV-17
  };

  const resolve = (real: object, path: ConfigPath, key: PropertyKey): KeyResolution | null => {
    if (typeof key !== 'string' || CONFIG_RECORDER_PROBE_KEYS.has(key)) return null;
    return resolveKey(real, path, key);
  };

  /** Record a terminal read of whatever `key` resolves to. */
  const recordTerminal = (real: object, path: ConfigPath, key: PropertyKey): void => {
    const resolution = resolve(real, path, key);
    if (resolution !== null) record(resolution.record, 'terminal');
  };

  /** The path a mutation names: the operation's target, formatted like a read would be. */
  const mutationPath = (real: object, path: ConfigPath, key: PropertyKey): ConfigPath => {
    if (typeof key !== 'string') return path;
    return resolveKey(real, path, key)?.record ?? path;
  };

  const refuse = (path: ConfigPath, operation: ProvenanceViewMutation): never => {
    throw new ProvenanceViewMutationError(path, operation); // INV-8
  };

  function viewOf(real: object, path: ConfigPath): object {
    const cached = viewsByTarget.get(real);
    if (cached !== undefined) return cached; // INV-12, INV-21: one view per target

    const handler: ProxyHandler<object> = {
      get(_shell, key) {
        assertOpen();
        const value: unknown = Reflect.get(real, key, real);
        const resolution = resolve(real, path, key);
        if (resolution === null) return value;
        // INV-35: only a read that hands out a child view is a traversal.
        const descends = resolution.child !== null && isDescendable(value);
        record(resolution.record, descends ? 'traversal' : 'terminal');
        if (!descends || resolution.child === null) return value; // INV-1
        return viewOf(value, resolution.child);
      },
      has(_shell, key) {
        assertOpen();
        // INV-5 (rev 2): `has` on an array — including an index probed by iteration — is a
        // dependency on the array, not an element read.
        if (
          Array.isArray(real) &&
          typeof key === 'string' &&
          !CONFIG_RECORDER_PROBE_KEYS.has(key)
        ) {
          record(path, 'terminal');
        } else {
          recordTerminal(real, path, key);
        }
        return Reflect.has(real, key);
      },
      ownKeys() {
        assertOpen();
        record(path, 'terminal'); // INV-3, INV-5
        return Reflect.ownKeys(real);
      },
      getOwnPropertyDescriptor(shell, key) {
        assertOpen();
        recordTerminal(real, path, key);
        const descriptor = Reflect.getOwnPropertyDescriptor(real, key);
        if (descriptor === undefined) return undefined;
        // INV-34: the array shell owns a non-configurable `length`; report it as
        // non-configurable and writable so the proxy invariant holds even when
        // the real array is frozen. Every other key is absent from the shell and
        // must be reported configurable.
        if (key === 'length' && Array.isArray(shell)) return { ...descriptor, writable: true };
        return { ...descriptor, configurable: true };
      },
      getPrototypeOf() {
        return Reflect.getPrototypeOf(real); // INV-1
      },
      set(_shell, key) {
        return refuse(mutationPath(real, path, key), 'set');
      },
      deleteProperty(_shell, key) {
        return refuse(mutationPath(real, path, key), 'delete');
      },
      defineProperty(_shell, key) {
        return refuse(mutationPath(real, path, key), 'define');
      },
      setPrototypeOf() {
        return refuse(path, 'setPrototype');
      },
      preventExtensions() {
        return refuse(path, 'preventExtensions');
      },
    };

    // Shadow target (D10, INV-26): an empty extensible shell of the right shape,
    // so proxy invariants are never checked against a frozen real object.
    const shell: object = Array.isArray(real) ? [] : {};
    const view = new Proxy(shell, handler);
    viewsByTarget.set(real, view);
    targetsByView.set(view, real);
    return view;
  }

  /**
   * Replace views with their raw targets throughout plain containers. A view's
   * target holds raw values already (child views are separate proxies over
   * separate targets), so a view resolves in one step; only containers the
   * caller built (`filter`, `map`, object literals) need walking.
   */
  function unwrapDeep(value: unknown, seen: Map<object, unknown>): unknown {
    if (typeof value !== 'object' || value === null) return value;
    const target = targetsByView.get(value);
    if (target !== undefined) return target;
    if (!isDescendable(value)) return value;
    const cached = seen.get(value);
    if (cached !== undefined) return cached;
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      seen.set(value, out);
      let changed = false;
      for (const item of value) {
        const unwrapped = unwrapDeep(item, seen);
        if (unwrapped !== item) changed = true;
        out.push(unwrapped);
      }
      if (!changed) seen.set(value, value);
      return changed ? out : value;
    }
    const out: Record<string, unknown> = Object.create(
      Object.getPrototypeOf(value) as object | null
    );
    seen.set(value, out);
    let changed = false;
    for (const key of Object.keys(value)) {
      const item = (value as Record<string, unknown>)[key];
      const unwrapped = unwrapDeep(item, seen);
      if (unwrapped !== item) changed = true;
      out[key] = unwrapped;
    }
    if (!changed) seen.set(value, value);
    return changed ? out : value;
  }

  const recorder: ConfigRecorder<T> = {
    // The one cast in the module: the root view is a Proxy over an empty shell
    // whose traps forward to `config`, so it behaves as `T` (INV-1).
    view: viewOf(config, ROOT_CONFIG_PATH) as T,
    drain() {
      const paths = report(sinceDrain);
      sinceDrain.clear(); // INV-13
      return paths;
    },
    all() {
      return report(allTime);
    },
  };

  return {
    recorder,
    close(filePath) {
      closedAs = { filePath };
    },
    unwrap<R>(value: R): R {
      return unwrapDeep(value, new Map()) as R;
    },
  };
}

/**
 * Wrap `config` in a recording view. Pure: two recorders over equal configs
 * produce equal paths for equal access sequences; no state is shared between
 * recorders.
 *
 * Recording is value-independent and shape-driven:
 * - `get`/`has`/`getOwnPropertyDescriptor` of a string key on a plain object
 *   records `parent.key` — including keys that are absent, `''`, `false`, `null`, `undefined`.
 * - on an array, a canonical index key records `parent[i]`; any other string key
 *   (`length`, `map`, `constructor`, …) records the array path itself.
 * - `ownKeys` (spread, `Object.keys`, `JSON.stringify`) records the parent path;
 *   `has` on an array records the array path whatever the key.
 * - symbol keys, inherited keys (`toString`, `constructor`, `__proto__`, …) and
 *   the fixed probe keys `CONFIG_RECORDER_PROBE_KEYS` record nothing.
 * - a key the dialect cannot carry (`''`, or containing `.`, `[`, `]`) records
 *   the parent path and returns the raw value.
 * - descent stops at non-plain objects (class instances, `Date`, `Map`, typed
 *   arrays): the access is recorded, the value is returned raw.
 *
 * What `drain()`/`all()` report is the recorded set after pruning: a `get` that
 * returns a child view is a traversal step and is dropped when a strict
 * descendant is in the same reported set; every other read is terminal and is
 * never dropped. `v.a.b` therefore reports `['a.b']`, while `if (v.a)` alone
 * reports `['a']`.
 *
 * The view is read-only: every mutation throws `ProvenanceViewMutationError`
 *. `structuredClone(view)` throws — templates must not clone config.
 */
export function createConfigRecorder<T extends object>(config: T): ConfigRecorder<T> {
  return openConfigRecorder(config).recorder;
}
