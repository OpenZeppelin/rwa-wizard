/**
 * INV-3 (newline counting), INV-4 (the one trimming rule), INV-26 (no file shape assumed).
 * Category: Request/Response.
 */
import { describe, expect, it } from 'vitest';

import { countNewlines, regionToLineRange } from '../../src/provenance/line-ranges';

const lineOfOffset = (text: string, offset: number): number =>
  1 + countNewlines(text.slice(0, offset));

describe('countNewlines', () => {
  it.each([
    ['', 0],
    ['abc', 0],
    ['a\nb', 1],
    ['\n\n\n', 3],
    ['a\r\nb\r\n', 2],
    ['\r', 0],
  ])('%j → %d', (text, expected) => {
    expect(countNewlines(text)).toBe(expected);
  });
});

describe('INV-4 — regionToLineRange trimming rule (D7), one input per memo key', () => {
  const text = 'line1\nline2\nline3\nfoo\nline5\n';

  it('(a) leading terminators: the range starts at the first non-terminator line', () => {
    // The `insertAfterExact(marker, '\n\nfoo')` shape: the inserted region opens
    // with the terminators that end the marker's own line, which it must not claim.
    const leading = 'marker\n\nfoo\ntail';
    const start = leading.indexOf('marker') + 'marker'.length;
    const range = regionToLineRange(leading, { start, end: start + '\n\nfoo'.length });
    expect(leading.split('\n').slice(range.start - 1, range.end)).toEqual(['foo']);
  });

  it('(b) trailing terminators: the range ends at the last non-terminator line', () => {
    const start = text.indexOf('foo');
    const range = regionToLineRange(text, { start, end: start + 'foo\n'.length });
    expect(text.split('\n').slice(range.start - 1, range.end)).toEqual(['foo']);
  });

  it('(c) terminator-only region: the single line of the region start', () => {
    const start = text.indexOf('\n');
    const range = regionToLineRange(text, { start, end: start + 1 });
    expect(range).toEqual({ start: 1, end: 1 });
  });

  it('(d) empty region: the single line containing the offset', () => {
    const offset = text.indexOf('line3');
    expect(regionToLineRange(text, { start: offset, end: offset })).toEqual({ start: 3, end: 3 });
  });

  it('(e) `\\r` is a non-attributing character: a `\\r`-only region is a singleton', () => {
    const crlf = 'a\r\nb\r\nc';
    const start = crlf.indexOf('\r');
    expect(regionToLineRange(crlf, { start, end: start + 1 })).toEqual({ start: 1, end: 1 });
    // and CRLF-terminated content attributes exactly like LF content
    const bStart = crlf.indexOf('b');
    expect(regionToLineRange(crlf, { start: bStart, end: bStart + 3 })).toEqual({
      start: 2,
      end: 2,
    });
  });

  it('a region ending at text.length after a trailing newline attributes to the trailing empty line', () => {
    expect(regionToLineRange(text, { start: text.length, end: text.length })).toEqual({
      start: 6,
      end: 6,
    });
  });

  it('empty text, empty region → {1,1}', () => {
    expect(regionToLineRange('', { start: 0, end: 0 })).toEqual({ start: 1, end: 1 });
  });

  it('a multi-line region covers every line holding one of its characters', () => {
    const start = text.indexOf('line2');
    const end = text.indexOf('foo') + 1;
    expect(regionToLineRange(text, { start, end })).toEqual({ start: 2, end: 4 });
  });

  it('property: 1 ≤ start ≤ end ≤ lines, and every non-terminator char of the region is inside the range', () => {
    const alphabet = ['a', 'b', '\n', '\r', '\n', ' ', 'é'];
    let seed = 42;
    const rand = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let i = 0; i < 500; i += 1) {
      const len = rand(24);
      let t = '';
      for (let j = 0; j < len; j += 1) t += alphabet[rand(alphabet.length)];
      const a = rand(t.length + 1);
      const b = a + rand(t.length + 1 - a);
      const range = regionToLineRange(t, { start: a, end: b });
      const lineCount = 1 + countNewlines(t);
      expect(range.start).toBeGreaterThanOrEqual(1);
      expect(range.end).toBeGreaterThanOrEqual(range.start);
      expect(range.end).toBeLessThanOrEqual(lineCount);
      let sawChar = false;
      for (let k = a; k < b; k += 1) {
        const ch = t.charAt(k);
        if (ch === '\n' || ch === '\r') continue;
        sawChar = true;
        const line = lineOfOffset(t, k);
        expect(line).toBeGreaterThanOrEqual(range.start);
        expect(line).toBeLessThanOrEqual(range.end);
      }
      if (!sawChar) expect(range).toEqual({ start: lineOfOffset(t, a), end: lineOfOffset(t, a) });
    }
  });
});
