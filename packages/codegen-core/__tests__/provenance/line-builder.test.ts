/**
 * INV-1 (byte identity), INV-3 (computed positions), INV-5/6 (attribution honesty),
 * INV-12/16 (seal, atomicity), INV-17 (idempotence), INV-19 (disabled parity),
 * INV-22 (side-effect order), INV-24 (observability), INV-26 (no file shape).
 */
import { describe, expect, it } from 'vitest';

import { ProvenanceAttributionError } from '../../src/provenance/errors';
import { createLineBuilder } from '../../src/provenance/line-builder';
import { countNewlines, regionToLineRange } from '../../src/provenance/line-ranges';
import { createSpyScope, linesOf } from './builder-fixtures';

describe('INV-1 — text() is elements.join(separator), byte for byte', () => {
  it.each([
    ['default separator', undefined],
    ['empty separator', ''],
    ['comma separator', ', '],
    ['double newline', '\n\n'],
    ['continuation separator', ' \\\n  '],
  ])('%s', (_name, separator) => {
    const elements = ['#!/bin/bash', '', 'set -e', 'a\nb', ' padded ', '\n', 'é'];
    const builder = createLineBuilder(
      createSpyScope(),
      separator === undefined ? undefined : { separator }
    );
    builder.line(elements[0] ?? '');
    builder.lines([elements[1] ?? '', elements[2] ?? '']);
    builder.block(elements[3] ?? '');
    builder.lines([]);
    builder.line(elements[4] ?? '');
    builder.line(elements[5] ?? '');
    builder.line(elements[6] ?? '');
    expect(builder.text()).toBe(elements.join(separator ?? '\n'));
  });

  it('an empty builder yields the empty string; a trailing empty element yields a trailing separator', () => {
    expect(createLineBuilder(createSpyScope()).text()).toBe('');
    const builder = createLineBuilder(createSpyScope());
    builder.line('[workspace]');
    builder.line('');
    expect(builder.text()).toBe('[workspace]\n');
  });

  it('property: random emission sequences equal their hand-joined counterpart', () => {
    const chunks = ['', '\n', '\r\n', 'x', 'a\nb', '  ', '\n\n', 'é', 'echo'];
    const separators = ['\n', '', ', ', ' \\\n  ', '\n\n'];
    let seed = 7;
    const rand = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let run = 0; run < 200; run += 1) {
      const separator = separators[rand(separators.length)] ?? '\n';
      const builder = createLineBuilder(createSpyScope(), { separator });
      const expected: string[] = [];
      for (let i = 0; i < rand(8); i += 1) {
        const chunk = chunks[rand(chunks.length)] ?? '';
        if (rand(3) === 0) {
          const group = [chunk, chunks[rand(chunks.length)] ?? ''];
          builder.lines(group);
          expected.push(...group);
        } else {
          builder.line(chunk);
          expected.push(chunk);
        }
      }
      expect(builder.text()).toBe(expected.join(separator));
    }
  });
});

describe('INV-3 / INV-4 — ranges are computed, never re-found', () => {
  it('every reported range equals regionToLineRange of that emission against the final text', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope, { separator: '\n' });
    const emissions: string[][] = [
      ['#!/bin/bash'],
      [''],
      ['a\nb\nc'],
      ['x', 'y'],
      ['\n\n'],
      ['tail'],
    ];
    const offsets: Array<{ start: number; end: number }> = [];
    let cursorOffset = 0;
    emissions.forEach((chunk, index) => {
      const joined = chunk.join('\n');
      const start = index === 0 ? 0 : cursorOffset + 1;
      offsets.push({ start, end: start + joined.length });
      cursorOffset = start + joined.length;
      scope.read(`p${index}`);
      builder.lines(chunk);
    });
    const text = builder.text();
    expect(scope.ranges).toHaveLength(emissions.length);
    scope.ranges.forEach((entry, index) => {
      const region = offsets[index];
      if (region === undefined) throw new Error('missing region');
      expect(entry.range).toEqual(regionToLineRange(text, region));
    });
  });

  it('(c) the first emission starts at line 1; the next starts after it', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.line('first');
    scope.read('b');
    builder.line('second');
    expect(scope.ranges.map((r) => r.range)).toEqual([
      { start: 1, end: 1 },
      { start: 2, end: 2 },
    ]);
  });

  it('(b) a block with k newlines covers k+1 lines; lines() is ONE range over all elements', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.block('a\nb\nc');
    scope.read('b');
    builder.lines(['d', 'e']);
    const text = builder.text();
    expect(scope.ranges.map((r) => r.range)).toEqual([
      { start: 1, end: 3 },
      { start: 4, end: 5 },
    ]);
    expect(linesOf(text, { start: 1, end: 3 })).toEqual(['a', 'b', 'c']);
    expect(linesOf(text, { start: 4, end: 5 })).toEqual(['d', 'e']);
  });

  it('a block ending in a newline does not claim the following line', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.block('a\nb\n');
    scope.read('b');
    builder.line('next');
    // The block's own trailing newline plus the separator open a blank line 3.
    expect(scope.ranges.map((r) => r.range)).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 4 },
    ]);
    expect(linesOf(builder.text(), { start: 4, end: 4 })).toEqual(['next']);
  });

  it('(a) a separator with no newline collapses every range to line 1', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope, { separator: ', ' });
    scope.read('a');
    builder.line('one');
    scope.read('b');
    builder.line('two');
    expect(scope.ranges.map((r) => r.range)).toEqual([
      { start: 1, end: 1 },
      { start: 1, end: 1 },
    ]);
    expect(builder.text()).toBe('one, two');
  });

  it('(a) a separator with two newlines leaves the blank line unattributed', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope, { separator: '\n\n' });
    scope.read('a');
    builder.line('one');
    scope.read('b');
    builder.line('two');
    expect(scope.ranges.map((r) => r.range)).toEqual([
      { start: 1, end: 1 },
      { start: 3, end: 3 },
    ]);
  });

  it('the continuation separator puts each element on its own line', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope, { separator: ' \\\n  ' });
    scope.read('a');
    builder.lines(['--name x', '--symbol y']);
    const text = builder.text();
    expect(text).toBe('--name x \\\n  --symbol y');
    expect(scope.ranges[0]?.range).toEqual({ start: 1, end: 2 });
  });

  it('repeated identical lines get three distinct ranges (a text search would find only the first)', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    for (let i = 0; i < 3; i += 1) {
      scope.read(`p${i}`);
      builder.line('echo ""');
    }
    expect(scope.ranges.map((r) => r.range)).toEqual([
      { start: 1, end: 1 },
      { start: 2, end: 2 },
      { start: 3, end: 3 },
    ]);
  });

  it('line("") still produces a valid one-line range', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.line('');
    expect(scope.ranges[0]?.range).toEqual({ start: 1, end: 1 });
  });

  it('lineCount is the number of lines text() would have now', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    expect(builder.lineCount).toBe(0);
    builder.line('a');
    expect(builder.lineCount).toBe(1);
    builder.block('b\nc');
    expect(builder.lineCount).toBe(3);
    expect(countNewlines(builder.text()) + 1).toBe(3);
  });

  it('property: no emission sequence produces an invalid range', () => {
    const chunks = ['', '\n', '\r\n', 'x', 'a\nb', '\n\n\n'];
    let seed = 99;
    const rand = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let run = 0; run < 200; run += 1) {
      const scope = createSpyScope();
      const builder = createLineBuilder(scope, {
        separator: ['\n', '', '\n\n', ', '][rand(4)] ?? '\n',
      });
      for (let i = 0; i < rand(6) + 1; i += 1) {
        scope.read(`p${i}`);
        builder.line(chunks[rand(chunks.length)] ?? '');
      }
      const lineCount = countNewlines(builder.text()) + 1;
      for (const { range } of scope.ranges) {
        expect(range.start).toBeGreaterThanOrEqual(1);
        expect(range.end).toBeGreaterThanOrEqual(range.start);
        expect(range.end).toBeLessThanOrEqual(lineCount);
      }
    }
  });
});

describe('INV-5 / INV-6 — the union rule and the addRange skip, one test per input', () => {
  it('(a) drained paths alone → one range', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('settings.name');
    builder.line('x');
    expect(scope.ranges).toEqual([{ range: { start: 1, end: 1 }, paths: ['settings.name'] }]);
  });

  it('(b) pending paths alone → one range built from the stashed window', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('settings.name');
    const observed = builder.observe(() => {
      scope.read('settings.symbol');
      return 1;
    });
    builder.line('x');
    expect(observed.paths).toEqual(['settings.symbol']);
    expect(scope.ranges[0]?.paths).toEqual(['settings.name']);
  });

  it('(c) extraPaths alone → one range', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    builder.line('x', ['explicit']);
    expect(scope.ranges[0]?.paths).toEqual(['explicit']);
  });

  it('(d) all three empty → no addRange at all', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    builder.line('constant');
    builder.lines(['a', 'b']);
    builder.block('c');
    expect(scope.ranges).toEqual([]);
    expect(scope.calls.filter((c) => c.kind === 'addRange')).toEqual([]);
  });

  it('extraPaths unions with the drain, it never replaces it', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('inline');
    builder.line('x', ['observed']);
    expect(scope.ranges[0]?.paths).toEqual(['inline', 'observed']);
  });

  it('six constant lines and two reading lines → exactly two ranges', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    for (let i = 0; i < 3; i += 1) builder.line(`c${i}`);
    scope.read('a');
    builder.line('reads a');
    for (let i = 0; i < 3; i += 1) builder.line(`c${i}`);
    scope.read('b');
    builder.line('reads b');
    expect(scope.ranges).toEqual([
      { range: { start: 4, end: 4 }, paths: ['a'] },
      { range: { start: 8, end: 8 }, paths: ['b'] },
    ]);
  });

  it('two consecutive emissions reading the same path are two ranges — nothing is merged', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.line('one');
    scope.read('a');
    builder.line('two');
    expect(scope.ranges).toEqual([
      { range: { start: 1, end: 1 }, paths: ['a'] },
      { range: { start: 2, end: 2 }, paths: ['a'] },
    ]);
  });

  it('the builder prunes nothing: an ancestor beside its descendant survives, malformed strings pass through', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('settings', 'settings.name');
    builder.line('x', ['a..b', '']);
    expect(scope.ranges[0]?.paths).toEqual(['', 'a..b', 'settings', 'settings.name']);
  });

  it('AS-1 — one line reading two fields yields exactly one range holding both, and no other range holds either', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    builder.line('# header');
    scope.read('settings.name', 'settings.symbol');
    builder.line('Deploying Alpha (ALP)');
    builder.line('# footer');
    expect(scope.ranges).toEqual([
      { range: { start: 2, end: 2 }, paths: ['settings.name', 'settings.symbol'] },
    ]);
  });
});

describe('INV-22 — pending set and side-effect order', () => {
  it('(b) lines([]) leaves the window pending for the next emission, advancing nothing', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.lines([]);
    expect(scope.ranges).toEqual([]);
    expect(builder.lineCount).toBe(0);
    builder.line('x');
    expect(scope.ranges[0]).toEqual({ range: { start: 1, end: 1 }, paths: ['a'] });
  });

  it('lines([]) accumulates across windows, and its extraPaths are kept too', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.lines([], ['explicit']);
    scope.read('b');
    builder.lines([]);
    builder.line('x');
    expect(scope.ranges[0]?.paths).toEqual(['a', 'b', 'explicit']);
  });

  it('(c) pending is cleared by an emission that adds a line', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.line('one');
    builder.line('two');
    expect(scope.ranges).toHaveLength(1);
  });

  it('each emission drains exactly once, and addRange is observed after the line exists', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.line('one');
    scope.read('b');
    builder.line('two');
    expect(scope.calls.map((c) => c.kind)).toEqual([
      'drain',
      'drain',
      'addRange',
      'drain',
      'addRange',
    ]);
  });

  it('a range whose addRange throws leaves the text intact (the loud arithmetic backstop)', () => {
    const throwing = {
      ...createSpyScope(),
      addRange(): void {
        throw new RangeError('boom');
      },
    };
    const builder = createLineBuilder(throwing);
    throwing.read('a');
    expect(() => builder.line('x')).toThrow(RangeError);
    expect(builder.text()).toBe('x');
  });
});

describe('INV-12 / INV-17 — seal and idempotence', () => {
  it('two text() calls return the identical string and drain exactly once', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    builder.line('x');
    const drainsBefore = scope.calls.filter((c) => c.kind === 'drain').length;
    const first = builder.text();
    const second = builder.text();
    expect(first).toBe(second);
    // Both calls together add exactly one trailing drain, and no range.
    expect(scope.calls.filter((c) => c.kind === 'drain')).toHaveLength(drainsBefore + 1);
  });

  it('trailing reads at text() attribute to no range', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    builder.line('x');
    scope.read('late');
    expect(builder.text()).toBe('x');
    expect(scope.ranges).toEqual([]);
  });

  it.each(['line', 'lines', 'block', 'observe'] as const)(
    '%s after text() throws emit-after-text without touching the scope',
    (method) => {
      const scope = createSpyScope();
      const builder = createLineBuilder(scope);
      builder.line('x');
      builder.text();
      const before = scope.calls.length;
      let caught: unknown;
      try {
        if (method === 'line') builder.line('y');
        if (method === 'lines') builder.lines(['y']);
        if (method === 'block') builder.block('y');
        if (method === 'observe') builder.observe(() => 1);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ProvenanceAttributionError);
      expect((caught as ProvenanceAttributionError).reason).toBe('emit-after-text');
      expect((caught as ProvenanceAttributionError).filePath).toBe('out/fixture.txt');
      expect(scope.calls.length).toBe(before);
      expect(builder.text()).toBe('x');
    }
  );

  it('lineCount and config remain readable after the seal', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    builder.line('x');
    builder.text();
    expect(builder.lineCount).toBe(1);
    expect(builder.config.settings.name).toBe('Alpha');
  });
});

describe('INV-19 — a disabled scope runs identical control flow', () => {
  const script = (scope: ReturnType<typeof createSpyScope>): string => {
    const builder = createLineBuilder(scope);
    scope.read('a');
    builder.line('#!/bin/bash');
    builder.lines(['set -e', '']);
    scope.read('b');
    builder.block('x\ny\n');
    builder.line('tail', ['explicit']);
    return builder.text();
  };

  it('produces the same text as an enabled scope', () => {
    expect(script(createSpyScope({ disabled: true }))).toBe(script(createSpyScope()));
  });

  it('still validates and passes a shape-valid range for an explicit-path emission', () => {
    const scope = createSpyScope({ disabled: true });
    script(scope);
    const added = scope.calls.filter((c) => c.kind === 'addRange');
    expect(added).toHaveLength(1);
    expect(added[0]).toEqual({
      kind: 'addRange',
      range: { start: 7, end: 7 },
      paths: ['explicit'],
    });
  });

  it('emit-after-text and builder-exists fire regardless', () => {
    const scope = createSpyScope({ disabled: true });
    const builder = createLineBuilder(scope);
    builder.text();
    expect(() => builder.line('x')).toThrow(ProvenanceAttributionError);
    expect(() => createLineBuilder(scope)).toThrow(ProvenanceAttributionError);
  });
});

describe('INV-18 / INV-24 — determinism and observability', () => {
  it('the same script over two scopes yields identical transcripts, in any order', () => {
    const run = (): ReturnType<typeof createSpyScope> => {
      const scope = createSpyScope();
      const builder = createLineBuilder(scope);
      scope.read('a');
      builder.line('one');
      builder.line('two', ['x']);
      builder.text();
      return scope;
    };
    const first = run();
    const second = run();
    expect(second.calls).toEqual(first.calls);
  });

  it('interleaved builders on two scopes each behave as their solo run', () => {
    const soloA = createSpyScope();
    const a1 = createLineBuilder(soloA);
    soloA.read('a');
    a1.line('one');
    a1.line('two');
    const soloB = createSpyScope();
    const b1 = createLineBuilder(soloB);
    soloB.read('b');
    b1.line('x');

    const scopeA = createSpyScope();
    const scopeB = createSpyScope();
    const a2 = createLineBuilder(scopeA);
    const b2 = createLineBuilder(scopeB);
    scopeA.read('a');
    a2.line('one');
    scopeB.read('b');
    b2.line('x');
    a2.line('two');

    expect(scopeA.calls).toEqual(soloA.calls);
    expect(scopeB.calls).toEqual(soloB.calls);
  });

  it('exposes exactly the documented members', () => {
    const builder = createLineBuilder(createSpyScope());
    expect(new Set(Object.keys(builder))).toEqual(
      new Set(['config', 'lineCount', 'line', 'lines', 'block', 'observe', 'text'])
    );
  });
});
