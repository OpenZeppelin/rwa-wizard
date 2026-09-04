import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HELPERS_DIR = dirname(fileURLToPath(import.meta.url));

/** `apps/rwa-wizard`. */
export const APP_ROOT = join(HELPERS_DIR, '../../..');

/** The monorepo root, for the workflow and copy-package guards. */
export const REPO_ROOT = join(APP_ROOT, '../..');

/**
 * Remove `//` line comments and `/* *\/` block comments — JSX `{/* *\/}` included,
 * since those are block comments inside braces — while leaving string and
 * template literals intact.
 *
 * **Stripping is not a tidiness measure, it is the whole reason these scans can
 * be trusted.** Every comment in the six new modules states the invariant the
 * code below it satisfies, so each one contains the token its scan forbids:
 * `fieldImpactView.ts` says "never throws", `PreviewImpactRow.tsx` says "no
 * roving tabindex", `useFieldImpact.ts` says "never `containsComposed`". A scan
 * over raw source fails on all three, and the natural repair is to delete the
 * sentence explaining why the code is shaped that way — trading the only
 * documentation of the property for a green scan.
 *
 * Block comments emit their newlines so reported line numbers stay true to the
 * file on disk.
 */
export function stripComments(source: string): string {
  let out = '';
  let index = 0;
  let quote: string | null = null;

  while (index < source.length) {
    const char = source[index]!;
    const next = source[index + 1];

    if (quote !== null) {
      if (char === '\\') {
        out += char + (source[index + 1] ?? '');
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      out += char;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      out += char;
      index += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') out += '\n';
        index += 1;
      }
      index += 2;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

/** One scanned file, in both forms, so a scan can prove the stripper ran. */
export interface ScannedSource {
  /** Repo-app-relative path, as written in the target list. */
  readonly path: string;
  readonly raw: string;
  readonly stripped: string;
}

/**
 * Read every named file, or throw naming the one that could not be read.
 *
 * Fails closed on an empty or missing file rather than returning fewer entries:
 * a scan over zero files reports "no matches" for every forbidden token and
 * looks exactly like a clean result. Code Draft hit precisely that — a scan that
 * passed a quoted shell variable to `grep`, read no files, and printed a green
 * report — so the count and the byte lengths are asserted by the callers.
 */
export function readScannedSources(relativePaths: readonly string[]): readonly ScannedSource[] {
  return relativePaths.map((path) => {
    const absolute = join(APP_ROOT, path);
    const stats = statSync(absolute);
    if (!stats.isFile() || stats.size === 0) {
      throw new Error(`source scan: ${path} is missing or empty (size ${stats.size})`);
    }
    const raw = readFileSync(absolute, 'utf8');
    return { path, raw, stripped: stripComments(raw) };
  });
}

/** Every line of `stripped` containing `token`, as `path:line` labels. */
export function findToken(source: ScannedSource, token: string): readonly string[] {
  return source.stripped
    .split('\n')
    .map((line, offset) => ({ line, number: offset + 1 }))
    .filter((entry) => entry.line.includes(token))
    .map((entry) => `${source.path}:${entry.number}: ${entry.line.trim()}`);
}

/** Every `path:line` in `sources` whose stripped text contains `token`. */
export function findTokenAcross(
  sources: readonly ScannedSource[],
  token: string
): readonly string[] {
  return sources.flatMap((source) => findToken(source, token));
}

/** A half-open `[start, end)` character range in a stripped source. */
export interface SourceRange {
  readonly start: number;
  readonly end: number;
}

/**
 * The character ranges spanned by every `<callee>(...)` in `source`, matched by
 * balancing parentheses and skipping quoted text.
 *
 * Used to answer "is this call site inside a `useEffect` body?" structurally
 * rather than by indentation or by a hand-maintained line list, so an unrelated
 * edit above it cannot move the answer. `source` is expected to be
 * comment-stripped already; a `(` inside a comment would otherwise unbalance the
 * count.
 */
export function callRangesOf(source: string, callee: string): readonly SourceRange[] {
  const ranges: SourceRange[] = [];
  const needle = `${callee}(`;
  let searchFrom = 0;

  for (;;) {
    const start = source.indexOf(needle, searchFrom);
    if (start === -1) return ranges;

    let depth = 0;
    let quote: string | null = null;
    let index = start + needle.length - 1;

    for (; index < source.length; index += 1) {
      const char = source[index]!;
      if (quote !== null) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        continue;
      }
      if (char === '(') depth += 1;
      else if (char === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    ranges.push({ start, end: index });
    searchFrom = start + needle.length;
  }
}

/** Whether `offset` falls inside any of `ranges`. */
export function isInsideAny(offset: number, ranges: readonly SourceRange[]): boolean {
  return ranges.some((range) => offset > range.start && offset < range.end);
}

/** Every character offset at which `token` occurs in `source`. */
export function offsetsOf(source: string, token: string): readonly number[] {
  const offsets: number[] = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf(token, from);
    if (at === -1) return offsets;
    offsets.push(at);
    from = at + token.length;
  }
}

/** 1-indexed line number of a character offset. */
export function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}
