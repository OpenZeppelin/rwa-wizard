import type { RWAConfig } from '@openzeppelin/rwa-config';

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

/** A bracket segment attaches directly; a key segment needs a dot. */
type Suffix<P extends string> = P extends `[${string}` ? P : `.${P}`;

/**
 * Recursive template-literal derivation of every dot-path location in `T`.
 * Unions distribute (both ownership variants' members are legal at the type
 * level — the runtime builder picks the one for the selected variant), arrays
 * yield `[${number}]`, and `Record<string, unknown>` yields `.${string}`.
 * Depth is bounded by `RWAConfig` itself. INV-4.
 */
type PathsOf<T> = T extends Primitive
  ? never
  : T extends readonly (infer U)[]
    ? `[${number}]` | `[${number}]${Suffix<PathsOf<U>>}`
    : {
        [K in keyof T & string]: K | `${K}${Suffix<PathsOf<NonNullable<T[K]>>>}`;
      }[keyof T & string];

/**
 * Dot-path dialect shared with codegen validation `ValidationError.field`:
 * dot-separated members, bracketed zero-based numeric indices.
 *
 * Examples: 'token.name' | 'accessControl.ownership.ownerAddress'
 *         | `identityVerification.trustedIssuers[${number}].address`
 *         | `compliance.modules[${number}].config.${string}`
 */
export type ConfigPath = PathsOf<RWAConfig>;

/** Parsed form, for consumers (SF-5) that compare paths segment-wise. Field names match codegen-core's `ConfigPathSegment`. */
export type ConfigPathSegment =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'index'; readonly index: number };

/**
 * Result of resolving a path against a config value. `found` is true when
 * every segment except the last resolves to a non-null object or array and
 * the last segment is an own property of its parent or an in-range index.
 * `value` is the leaf (may be `undefined` for an own property holding it).
 */
export interface ConfigPathResolution {
  readonly found: boolean;
  readonly value: unknown;
}

/**
 * Only reachable from a malformed string arriving across the codegen
 * boundary — builders never produce one. INV-5.
 */
export class ConfigPathSyntaxError extends Error {
  readonly code = 'CONFIG_PATH_SYNTAX' as const;

  constructor(
    readonly path: string,
    readonly offset: number,
    reason: string
  ) {
    super(`invalid config path ${JSON.stringify(path)} at offset ${offset}: ${reason}`);
    this.name = 'ConfigPathSyntaxError';
  }
}

const KEY_CHAR = /[^.[\]\s]/;
const DIGIT = /[0-9]/;

function isKeyChar(ch: string | undefined): ch is string {
  return ch !== undefined && KEY_CHAR.test(ch);
}

/**
 * Split a path into segments: `'a.b[2].c'` → key a, key b, index 2, key c.
 *
 * Grammar: `key ( '.' key | '[' index ']' )*`, where `key` is one or more
 * characters other than `.`, `[`, `]` and whitespace, and `index` is `0` or a
 * digit string with no leading zero. Throws `ConfigPathSyntaxError` on
 * anything else. Pure. INV-5.
 */
export function parseConfigPath(path: string): readonly ConfigPathSegment[] {
  const segments: ConfigPathSegment[] = [];
  let pos = 0;

  const readKey = (): void => {
    const start = pos;
    while (isKeyChar(path[pos])) pos += 1;
    if (pos === start) {
      throw new ConfigPathSyntaxError(path, start, 'expected a key');
    }
    segments.push({ kind: 'key', key: path.slice(start, pos) });
  };

  const readIndex = (): void => {
    // Called with `pos` on the opening bracket.
    pos += 1;
    const start = pos;
    while (path[pos] !== undefined && DIGIT.test(path[pos] as string)) pos += 1;
    const digits = path.slice(start, pos);
    if (digits.length === 0) {
      throw new ConfigPathSyntaxError(path, start, 'expected a numeric index');
    }
    if (digits.length > 1 && digits.startsWith('0')) {
      throw new ConfigPathSyntaxError(path, start, 'index has a leading zero');
    }
    if (path[pos] !== ']') {
      throw new ConfigPathSyntaxError(path, pos, "expected ']'");
    }
    pos += 1;
    segments.push({ kind: 'index', index: Number(digits) });
  };

  readKey();
  while (pos < path.length) {
    const ch = path[pos];
    if (ch === '.') {
      pos += 1;
      readKey();
    } else if (ch === '[') {
      readIndex();
    } else {
      throw new ConfigPathSyntaxError(path, pos, "expected '.' or '['");
    }
  }
  return segments;
}

/** Inverse of `parseConfigPath`: `format(parse(p)) === p` for every valid `p`. INV-5. */
export function formatConfigPath(segments: readonly ConfigPathSegment[]): string {
  let out = '';
  for (const segment of segments) {
    if (segment.kind === 'index') {
      out += `[${segment.index}]`;
    } else {
      out += out.length === 0 ? segment.key : `.${segment.key}`;
    }
  }
  return out;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Walk a config value along a path. Never throws: a malformed path, a
 * prototype key, an out-of-range index or a segment applied to the wrong
 * container kind all yield `{ found: false, value: undefined }`. INV-7.
 */
export function resolveConfigPath(config: RWAConfig, path: string): ConfigPathResolution {
  let segments: readonly ConfigPathSegment[];
  try {
    segments = parseConfigPath(path);
  } catch (error) {
    if (error instanceof ConfigPathSyntaxError) return NOT_FOUND;
    throw error;
  }

  let current: unknown = config;
  for (const segment of segments) {
    if (segment.kind === 'key') {
      if (!isObjectLike(current) || !Object.prototype.hasOwnProperty.call(current, segment.key)) {
        return NOT_FOUND;
      }
      current = current[segment.key];
    } else {
      if (!Array.isArray(current) || segment.index >= current.length) return NOT_FOUND;
      current = (current as readonly unknown[])[segment.index];
    }
  }
  return { found: true, value: current };
}

/**
 * True when `path` names a collection index the draft does not hold yet:
 * walking fails on an index segment where `index >= array.length`.
 *
 * Absent optional keys — omitted `token.initialSupply`, a selected module
 * with no `config` object yet — are **not** pending slots. Those paths still
 * name a live field; only the next append index on a collection is "uncreated".
 */
export function isPendingCollectionSlot(config: RWAConfig, path: string): boolean {
  let segments: readonly ConfigPathSegment[];
  try {
    segments = parseConfigPath(path);
  } catch (error) {
    if (error instanceof ConfigPathSyntaxError) return false;
    throw error;
  }

  let current: unknown = config;
  for (const segment of segments) {
    if (segment.kind === 'key') {
      if (!isObjectLike(current) || !Object.prototype.hasOwnProperty.call(current, segment.key)) {
        return false;
      }
      current = current[segment.key];
    } else {
      if (!Array.isArray(current)) return false;
      if (segment.index >= current.length) return true;
      current = (current as readonly unknown[])[segment.index];
    }
  }
  return false;
}

/**
 * True when walking fails only because an own-key is missing on an object the
 * draft already reaches (sparse default-draft shapes). Distinct from a pending
 * collection slot (out-of-range index) and from a malformed walk.
 */
export function isAbsentOptionalConfigPath(config: RWAConfig, path: string): boolean {
  let segments: readonly ConfigPathSegment[];
  try {
    segments = parseConfigPath(path);
  } catch (error) {
    if (error instanceof ConfigPathSyntaxError) return false;
    throw error;
  }

  let current: unknown = config;
  for (const segment of segments) {
    if (segment.kind === 'key') {
      if (!isObjectLike(current)) return false;
      if (!Object.prototype.hasOwnProperty.call(current, segment.key)) return true;
      current = current[segment.key];
    } else {
      if (!Array.isArray(current) || segment.index >= current.length) return false;
      current = (current as readonly unknown[])[segment.index];
    }
  }
  return false;
}

const NOT_FOUND: ConfigPathResolution = Object.freeze({ found: false, value: undefined });
