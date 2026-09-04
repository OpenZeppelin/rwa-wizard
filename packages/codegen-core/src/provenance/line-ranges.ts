/**
 * The line arithmetic both builders share. One trimming rule, defined once:
 * a range covers the lines holding at least one character of an emission other
 * than a line terminator; an emission with no such character attributes to the
 * single line it starts on.
 */
import type { ConfigPath, ProvenanceLineRange } from './types';

/** A half-open byte region `[start, end)` of some text, with the paths that produced it. */
export interface TextRegion {
  readonly start: number;
  readonly end: number;
  readonly paths: readonly ConfigPath[];
}

/**
 * Count of `'\n'` in `text` — the only line terminator the range dialect knows.
 * `'\r\n'` counts once, through its `'\n'`.
 */
export function countNewlines(text: string): number {
  let count = 0;
  let index = text.indexOf('\n');
  while (index !== -1) {
    count += 1;
    index = text.indexOf('\n', index + 1);
  }
  return count;
}

/**
 * THE trimming rule. `chunk` is an emitted piece of text whose first character
 * sits on 1-indexed line `startLine` of the final text; the result is the range
 * of lines holding at least one character of `chunk` other than `'\n'`/`'\r'`,
 * or `{ startLine, startLine }` when it holds none.
 *
 * Never returns `start < 1` or `end < start` for `startLine >= 1`.
 */
export function trimToAttributedLines(chunk: string, startLine: number): ProvenanceLineRange {
  let line = startLine;
  let first = -1;
  let last = -1;
  for (let i = 0; i < chunk.length; i += 1) {
    const character = chunk.charAt(i);
    if (character === '\n') {
      line += 1;
      continue;
    }
    if (character === '\r') continue;
    if (first === -1) first = line;
    last = line;
  }
  return first === -1 ? { start: startLine, end: startLine } : { start: first, end: last };
}

/**
 * `true` when `chunk` holds at least one character the trimming rule attributes
 * — anything other than `'\n'` and `'\r'`.
 */
export function hasAttributableContent(chunk: string): boolean {
  for (let i = 0; i < chunk.length; i += 1) {
    const character = chunk.charAt(i);
    if (character !== '\n' && character !== '\r') return true;
  }
  return false;
}

/**
 * The same rule addressed by byte offsets into a known text: resolve
 * `[region.start, region.end)` of `text` to the lines it attributes to.
 * `0 <= start <= end <= text.length` is the caller's responsibility.
 */
export function regionToLineRange(
  text: string,
  region: { readonly start: number; readonly end: number }
): ProvenanceLineRange {
  const startLine = 1 + countNewlines(text.slice(0, region.start));
  return trimToAttributedLines(text.slice(region.start, region.end), startLine);
}
