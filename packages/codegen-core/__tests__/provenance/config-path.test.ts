/**
 * Config-path dialect: parser, formatter, matcher (INV-10, INV-22, INV-24, INV-25).
 * Category: Error Semantics + Resource Limits + Re-usability.
 */
import { describe, expect, it } from 'vitest';

import {
  formatConfigPath,
  matchesConfigPath,
  parseConfigPath,
} from '../../src/provenance/config-path';
import { ROOT_CONFIG_PATH } from '../../src/provenance/types';
import type { ConfigPathSegment } from '../../src/provenance/types';

const key = (k: string): ConfigPathSegment => ({ kind: 'key', key: k });
const index = (i: number): ConfigPathSegment => ({ kind: 'index', index: i });

describe('INV-25 — the path dialect round-trips', () => {
  it('ROOT_CONFIG_PATH is the empty string and parses to no segments', () => {
    expect(ROOT_CONFIG_PATH).toBe('');
    expect(parseConfigPath('')).toEqual([]);
    expect(formatConfigPath([])).toBe('');
  });

  it("parses 'a.b[2].c' to [key a, key b, index 2, key c]", () => {
    expect(parseConfigPath('a.b[2].c')).toEqual([key('a'), key('b'), index(2), key('c')]);
  });

  it.each([
    'a',
    'a.b',
    'a[0]',
    'a[12]',
    'a[0][1]',
    'a.b[2].c',
    'settings.name',
    'members[1].address',
    'items[0].config.limit',
    'identityVerification.trustedIssuers[1].address',
    'compliance.modules[10].config.maxBalance',
    '名前',
    'a.名前[3].b',
    'UPPER.lower.MiXeD',
    'digits123.4x',
  ])('formatConfigPath(parseConfigPath(%j)) === %j', (path) => {
    expect(formatConfigPath(parseConfigPath(path))).toBe(path);
  });

  it('parse(format(segments)) deep-equals segments for representable segment lists (property-style)', () => {
    // Deterministic pseudo-random generator so the test is repeatable.
    let seed = 0x2f6e2b1;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    const alphabet = 'abcXYZ_09名前-$';
    for (let round = 0; round < 500; round += 1) {
      const length = 1 + (next() % 6);
      const segments: ConfigPathSegment[] = [];
      for (let i = 0; i < length; i += 1) {
        // First segment must be a key (INV-25: the root is an object).
        if (i > 0 && next() % 3 === 0) {
          segments.push(index(next() % 1000));
        } else {
          const len = 1 + (next() % 5);
          let k = '';
          for (let j = 0; j < len; j += 1) k += alphabet[next() % alphabet.length];
          segments.push(key(k));
        }
      }
      const formatted = formatConfigPath(segments);
      expect(parseConfigPath(formatted), `segments=${JSON.stringify(segments)}`).toEqual(segments);
    }
  });

  it("the dialect equals ValidationError.field's ('identityVerification.trustedIssuers[1].address')", () => {
    expect(parseConfigPath('identityVerification.trustedIssuers[1].address')).toEqual([
      key('identityVerification'),
      key('trustedIssuers'),
      index(1),
      key('address'),
    ]);
  });
});

describe('INV-10 / INV-25 — malformed paths throw RangeError at the first bad offset', () => {
  it.each([
    ['a..b', 'empty key segment'],
    ['.a', 'empty key segment'],
    ['a.', 'trailing "."'],
    ['[0]', 'a path may not start with an index'],
    ['a[x]', 'canonical'],
    ['a[01]', 'canonical'],
    ['a[-1]', 'canonical'],
    ['a[ 1]', 'canonical'],
    ['a[1.0]', 'canonical'],
    ['a[1e3]', 'canonical'],
    ['a[', 'unterminated index'],
    ['a]', 'unexpected "]"'],
    ['a.[0]', 'empty key segment before an index'],
    ['a[0]b', 'separated'],
    ['a[0]]', 'unexpected "]"'],
    ['a b]', 'unexpected "]"'],
  ])('parseConfigPath(%j) throws RangeError mentioning %j', (path, detail) => {
    expect(() => parseConfigPath(path)).toThrowError(RangeError);
    expect(() => parseConfigPath(path)).toThrowError(detail);
  });

  it('the parser error names the offending path and an offset (diagnosable, not a config value)', () => {
    expect(() => parseConfigPath('a..b')).toThrowError(
      /Malformed config path "a\.\.b" at offset 2/
    );
  });

  it.each<[readonly ConfigPathSegment[], string]>([
    [[index(0)], 'may not start with an index'],
    [[key('a'), key('')], 'cannot be represented'],
    [[key('a'), key('b.c')], 'cannot be represented'],
    [[key('a'), key('b[0]')], 'cannot be represented'],
    [[key('a'), key(']')], 'cannot be represented'],
    [[key('a'), index(-1)], 'not a non-negative integer'],
    [[key('a'), index(1.5)], 'not a non-negative integer'],
    [[key('a'), index(Number.NaN)], 'not a non-negative integer'],
  ])(
    'formatConfigPath(%j) throws RangeError (%s) rather than emitting a lying path',
    (segments, detail) => {
      expect(() => formatConfigPath(segments)).toThrowError(RangeError);
      expect(() => formatConfigPath(segments)).toThrowError(detail);
    }
  );

  it('matchesConfigPath throws RangeError on a malformed side instead of returning false', () => {
    expect(() => matchesConfigPath('a..b', 'a')).toThrowError(RangeError);
    expect(() => matchesConfigPath('a', 'a[01]')).toThrowError(RangeError);
  });
});

describe('INV-22 — matchesConfigPath is the single segment-boundary ancestor-or-equal rule', () => {
  it.each<[string, string, boolean]>([
    ['token', 'token.name', true],
    ['trustedIssuers', 'trustedIssuers[1].address', true],
    ['compliance.modules[0].moduleId', 'compliance.modules[0]', true],
    ['', 'anything', true],
    ['anything', '', true],
    ['', '', true],
    ['token.name', 'token.name', true],
    ['trustedIssuers[1].address', 'trustedIssuers[0].address', false],
    ['token.nameX', 'token.name', false],
    ['token.name', 'token.nameX', false],
    ['a[1]', 'a.1', false],
    ['a.1', 'a[1]', false],
    ['compliance.modules[1]', 'compliance.modules[10]', false],
    ['compliance.modules[10]', 'compliance.modules[1]', false],
    ['a.b', 'a.c', false],
    ['a[0].b', 'a[0].c', false],
  ])('matchesConfigPath(%j, %j) === %s', (recorded, query, expected) => {
    expect(matchesConfigPath(recorded, query)).toBe(expected);
  });

  it('is symmetric for every pair in the table', () => {
    const pairs: Array<[string, string]> = [
      ['token', 'token.name'],
      ['a[1]', 'a.1'],
      ['trustedIssuers[1].address', 'trustedIssuers[0].address'],
      ['', 'x.y[2]'],
    ];
    for (const [a, b] of pairs) {
      expect(matchesConfigPath(a, b), `${a} vs ${b}`).toBe(matchesConfigPath(b, a));
    }
  });

  it('stays bounded on long paths (no recursion, linear in segment count)', () => {
    const deep = Array.from({ length: 5000 }, (_, i) => `k${i}`).join('.');
    expect(matchesConfigPath(deep, deep)).toBe(true);
    expect(matchesConfigPath(deep, `${deep}.more`)).toBe(true);
    expect(matchesConfigPath(deep, 'k0.other')).toBe(false);
  });
});
