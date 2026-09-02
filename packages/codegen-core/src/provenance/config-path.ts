import { ROOT_CONFIG_PATH } from './types';
import type { ConfigPath, ConfigPathSegment } from './types';

/**
 * `true` for a string that is the canonical decimal form of a non-negative
 * integer: `'0'`, `'12'` — not `'01'`, `'-1'`, `' 1'`, `'1e3'`, `'1.0'`.
 * Shared by the parser and the recorder so both sides of the round-trip agree.
 */
export function isCanonicalIndexKey(key: string): boolean {
  const n = Number(key);
  return Number.isInteger(n) && n >= 0 && String(n) === key;
}

/** A key the dialect can carry verbatim: non-empty, no `.`, `[` or `]`. */
export function isRepresentableKey(key: string): boolean {
  return key.length > 0 && !/[.[\]]/.test(key);
}

function malformed(path: ConfigPath, position: number, detail: string): RangeError {
  return new RangeError(`Malformed config path "${path}" at offset ${position}: ${detail}`);
}

/**
 * `''` → `[]`; `'a.b[2].c'` → `[key a, key b, index 2, key c]`.
 *
 * Throws `RangeError` on malformed input: empty key segments (`'a..b'`, `'.a'`,
 * `'a.'`), a leading index (`'[0]'` — the root is an object), a non-canonical
 * index (`'a[01]'`, `'a[-1]'`, `'a[x]'`), or an unterminated bracket.
 */
export function parseConfigPath(path: ConfigPath): ConfigPathSegment[] {
  const segments: ConfigPathSegment[] = [];
  if (path === ROOT_CONFIG_PATH) return segments;

  let i = 0;
  let expectKey = true;
  while (i < path.length) {
    const ch = path.charAt(i);
    if (ch === '.') {
      if (expectKey) throw malformed(path, i, 'empty key segment');
      i += 1;
      expectKey = true;
      continue;
    }
    if (ch === '[') {
      if (segments.length === 0) throw malformed(path, i, 'a path may not start with an index');
      if (expectKey) throw malformed(path, i, 'empty key segment before an index');
      const close = path.indexOf(']', i);
      if (close === -1) throw malformed(path, i, 'unterminated index');
      const digits = path.slice(i + 1, close);
      if (!isCanonicalIndexKey(digits))
        throw malformed(path, i + 1, 'index is not a canonical non-negative integer');
      segments.push({ kind: 'index', index: Number(digits) });
      i = close + 1;
      continue;
    }
    if (ch === ']') throw malformed(path, i, 'unexpected "]"');
    if (!expectKey)
      throw malformed(path, i, 'a key must be separated from the previous segment by "."');

    let end = i;
    while (end < path.length && path.charAt(end) !== '.' && path.charAt(end) !== '[') {
      if (path.charAt(end) === ']') throw malformed(path, end, 'unexpected "]"');
      end += 1;
    }
    segments.push({ kind: 'key', key: path.slice(i, end) });
    i = end;
    expectKey = false;
  }
  if (expectKey) throw malformed(path, path.length, 'trailing "."');
  return segments;
}

/**
 * Inverse of `parseConfigPath`. Throws `RangeError` for a segment list the
 * dialect cannot carry: a leading index, an unrepresentable key, or a
 * non-canonical index.
 */
export function formatConfigPath(segments: readonly ConfigPathSegment[]): ConfigPath {
  let out = '';
  segments.forEach((segment, position) => {
    if (segment.kind === 'key') {
      if (!isRepresentableKey(segment.key)) {
        throw new RangeError(
          `Config path key at segment ${position} cannot be represented in the path dialect`
        );
      }
      out = position === 0 ? segment.key : `${out}.${segment.key}`;
      return;
    }
    if (position === 0) throw new RangeError('A config path may not start with an index');
    if (!isCanonicalIndexKey(String(segment.index))) {
      throw new RangeError(
        `Config path index at segment ${position} is not a non-negative integer`
      );
    }
    out = `${out}[${segment.index}]`;
  });
  return out;
}

/** Segment-wise comparison used by `matchesConfigPath` and `filterProvenanceByPath`. */
export function matchesConfigPathSegments(
  recorded: readonly ConfigPathSegment[],
  query: readonly ConfigPathSegment[]
): boolean {
  const shared = Math.min(recorded.length, query.length);
  for (let i = 0; i < shared; i += 1) {
    const a = recorded[i];
    const b = query[i];
    if (a === undefined || b === undefined || a.kind !== b.kind) return false;
    if (a.kind === 'key' && b.kind === 'key' && a.key !== b.key) return false;
    if (a.kind === 'index' && b.kind === 'index' && a.index !== b.index) return false;
  }
  return true;
}

/**
 * THE matching rule, defined once. `true` when `recorded` and `query`
 * are equal or one is a segment-boundary prefix of the other:
 *
 * - recorded `'settings'` matches query `'settings.name'` (parent read, child asked)
 * - recorded `'items[0].id'` matches query `'items[0]'` (child read, parent asked)
 * - recorded `''` matches every query, and every recorded path matches query `''`
 * - recorded `'members[1].address'` does NOT match `'members[0].address'`
 * - recorded `'settings.nameX'` does NOT match `'settings.name'`
 * - `'a[1]'` does NOT match `'a.1'` — segment kinds must agree
 *
 * Throws `RangeError` on malformed input rather than returning `false`.
 */
export function matchesConfigPath(recorded: ConfigPath, query: ConfigPath): boolean {
  return matchesConfigPathSegments(parseConfigPath(recorded), parseConfigPath(query));
}
