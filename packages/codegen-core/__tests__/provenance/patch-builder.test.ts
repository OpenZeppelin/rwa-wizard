/**
 * INV-2 (byte identity with the core primitives), INV-7 (region shifting and
 * marker exclusion), INV-10/16 (error semantics and atomicity), INV-12/17
 * (seal, idempotence), INV-19 (disabled parity), INV-23 (deferred resolution),
 * INV-24 (observability).
 */
import { describe, expect, it } from 'vitest';

import { ProvenanceAttributionError } from '../../src/provenance/errors';
import { createPatchBuilder } from '../../src/provenance/patch-builder';
import { insertAfterExact, insertBeforeExact, replaceExact } from '../../src/source-patch';
import { createSpyScope, linesOf } from './builder-fixtures';

const SOURCE = [
  'mod contract {',
  '    // roles',
  '    pub const ADMIN: u32 = 0;',
  '',
  '    pub fn init(e: &Env, name: String) {',
  '        Base::set_metadata(e, 7, name);',
  '    }',
  '}',
  '',
].join('\n');

describe('INV-2 — text() equals the sequential core-function result', () => {
  it('a 5-edit sequence matches the hand-sequenced primitives byte for byte', () => {
    const builder = createPatchBuilder(createSpyScope(), SOURCE);
    builder.replaceExact('Base::set_metadata(e, 7, name);', 'Base::set_metadata(e, 18, name);');
    builder.insertBeforeExact('    pub fn init', '    pub const MANAGER: u32 = 1;\n\n');
    builder.insertAfterExact('    // roles', '\n    // generated');
    builder.replaceExact('mod contract {', 'mod contract {');
    builder.insertAfterExact('}\n', '\n// tail\n');

    let expected = SOURCE;
    expected = replaceExact(
      expected,
      'Base::set_metadata(e, 7, name);',
      'Base::set_metadata(e, 18, name);'
    );
    expected = insertBeforeExact(
      expected,
      '    pub fn init',
      '    pub const MANAGER: u32 = 1;\n\n'
    );
    expected = insertAfterExact(expected, '    // roles', '\n    // generated');
    expected = replaceExact(expected, 'mod contract {', 'mod contract {');
    expected = insertAfterExact(expected, '}\n', '\n// tail\n');

    expect(builder.text()).toBe(expected);
  });

  it('current after each call equals the same prefix of core calls', () => {
    const builder = createPatchBuilder(createSpyScope(), SOURCE);
    expect(builder.current).toBe(SOURCE);
    builder.replaceExact('ADMIN', 'OWNER');
    const afterFirst = replaceExact(SOURCE, 'ADMIN', 'OWNER');
    expect(builder.current).toBe(afterFirst);
    builder.insertAfterExact('mod contract {', '\n    // note');
    expect(builder.current).toBe(insertAfterExact(afterFirst, 'mod contract {', '\n    // note'));
  });

  it('replacement patterns behave exactly as String.prototype.replace does today', () => {
    const source = 'alpha BETA gamma';
    const builder = createPatchBuilder(createSpyScope(), source);
    builder.replaceExact('BETA', 'x$&y');
    expect(builder.text()).toBe(source.replace('BETA', 'x$&y'));
  });

  it('reading current does not drain the scope', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, SOURCE);
    const drainsBefore = scope.calls.filter((c) => c.kind === 'drain').length;
    expect(builder.current.includes('ADMIN')).toBe(true);
    expect(scope.calls.filter((c) => c.kind === 'drain')).toHaveLength(drainsBefore);
  });
});

describe('INV-7 — regions resolve against the final text', () => {
  it('AS-4 — an insert reading config attributes exactly the inserted lines', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, SOURCE);
    scope.read('settings.decimals');
    builder.insertAfterExact('    pub const ADMIN: u32 = 0;', '\n    pub const DECIMALS: u32 = 7;');
    const text = builder.text();
    expect(scope.ranges).toHaveLength(1);
    const entry = scope.ranges[0];
    if (entry === undefined) throw new Error('missing range');
    expect(linesOf(text, entry.range)).toEqual(['    pub const DECIMALS: u32 = 7;']);
    expect(entry.paths).toEqual(['settings.decimals']);
    // every other line of the file carries no attribution
    const attributed = new Set<number>();
    for (let line = entry.range.start; line <= entry.range.end; line += 1) attributed.add(line);
    text.split('\n').forEach((_line, index) => {
      if (!attributed.has(index + 1)) expect(attributed.has(index + 1)).toBe(false);
    });
  });

  it('(a) insert-after excludes the marker; insert-before excludes the trailing marker', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, SOURCE);
    scope.read('after');
    builder.insertAfterExact('    // roles', '\n    // A');
    scope.read('before');
    builder.insertBeforeExact('    pub fn init', '    // B\n');
    const text = builder.text();
    expect(scope.ranges.map((entry) => linesOf(text, entry.range))).toEqual([
      ['    // A'],
      ['    // B'],
    ]);
  });

  it('(b) a marker rewritten by a replacement pattern attributes the whole piece, positions still in sync', () => {
    const source = 'head\nx$&y\ntail';
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, source);
    scope.read('p');
    builder.insertAfterExact('x$&y', 'Z');
    const text = builder.text();
    expect(text).toBe(insertAfterExact(source, 'x$&y', 'Z'));
    const entry = scope.ranges[0];
    if (entry === undefined) throw new Error('missing range');
    expect(linesOf(text, entry.range).join('\n')).toContain('Z');
  });

  it('the attributed slice is exactly the produced piece for a plain insert', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, 'a\nMARK\nb');
    scope.read('p');
    builder.insertAfterExact('MARK', 'ER');
    const text = builder.text();
    expect(text).toBe('a\nMARKER\nb');
    expect(linesOf(text, scope.ranges[0]?.range ?? { start: 0, end: 0 })).toEqual(['MARKER']);
  });

  it('(a)/(b)/(c) region shifting: before, after, and overlapping the edited span', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, 'AAA\nBBB\nCCC\nDDD');
    scope.read('first');
    builder.replaceExact('CCC', 'C1');
    scope.read('second');
    builder.insertBeforeExact('AAA', 'ZERO\n'); // shifts the first region right
    const text = builder.text();
    expect(text).toBe('ZERO\nAAA\nBBB\nC1\nDDD');
    expect(scope.ranges.map((entry) => linesOf(text, entry.range))).toEqual([['C1'], ['ZERO']]);
  });

  it('chained insertAfter on a prior insert keeps each region on its own line', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, 'line1\nanchor\nline3');
    scope.read('a');
    builder.insertAfterExact('anchor', '\ninsert-a', ['a']);
    scope.read('b');
    builder.insertAfterExact('insert-a', '\ninsert-b', ['b']);
    const text = builder.text();
    expect(text).toBe('line1\nanchor\ninsert-a\ninsert-b\nline3');
    expect(scope.ranges.map((entry) => linesOf(text, entry.range))).toEqual([
      ['insert-a'],
      ['insert-b'],
    ]);
    expect(scope.ranges.map((entry) => entry.paths)).toEqual([['a'], ['b']]);
  });

  it('chained insertBefore on a prior insert shifts the earlier region by delta', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, 'line1\nanchor\nline3');
    scope.read('a');
    builder.insertBeforeExact('anchor', 'insert-a\n', ['a']);
    scope.read('b');
    // Anchor on the prior insert's full payload (including the trailing newline),
    // the insertBefore twin of the insertAfter case above.
    builder.insertBeforeExact('insert-a\n', 'insert-b\n', ['b']);
    const text = builder.text();
    expect(text).toBe('line1\ninsert-b\ninsert-a\nanchor\nline3');
    expect(scope.ranges.map((entry) => linesOf(text, entry.range))).toEqual([
      ['insert-a'],
      ['insert-b'],
    ]);
    expect(scope.ranges.map((entry) => entry.paths)).toEqual([['a'], ['b']]);
  });

  it('sequential inserts at increasing then decreasing offsets keep every earlier region on its content', () => {
    const source = ['one', 'two', 'three', 'four', 'five'].join('\n');
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, source);
    scope.read('a');
    builder.insertAfterExact('two', '\nAFTER-TWO');
    scope.read('b');
    builder.insertAfterExact('four', '\nAFTER-FOUR');
    scope.read('c');
    builder.insertBeforeExact('one', 'BEFORE-ONE\n');
    const text = builder.text();
    expect(scope.ranges.map((entry) => linesOf(text, entry.range))).toEqual([
      ['AFTER-TWO'],
      ['AFTER-FOUR'],
      ['BEFORE-ONE'],
    ]);
  });

  it('D12 — a byte-identical replacement still records its region', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, SOURCE);
    scope.read('settings.name');
    builder.replaceExact('    // roles', '    // roles');
    const text = builder.text();
    expect(text).toBe(SOURCE);
    expect(scope.ranges).toHaveLength(1);
    expect(linesOf(text, scope.ranges[0]?.range ?? { start: 0, end: 0 })).toEqual(['    // roles']);
    expect(scope.ranges[0]?.paths).toEqual(['settings.name']);
  });

  it('D13 — an edit inside an earlier region clips it and unions its paths into the new one', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, 'head\nMARK\ntail');
    scope.read('outer');
    builder.insertAfterExact('MARK', '\nOUTER-A\nOUTER-B');
    scope.read('inner');
    builder.replaceExact('OUTER-A', 'INNER');
    const text = builder.text();
    expect(text).toBe('head\nMARK\nINNER\nOUTER-B\ntail');
    const [outer, inner] = scope.ranges;
    if (outer === undefined || inner === undefined) throw new Error('missing ranges');
    // the clipped remainder of the outer region no longer covers the replaced line
    expect(linesOf(text, outer.range)).toEqual(['OUTER-B']);
    expect(outer.paths).toEqual(['outer']);
    expect(linesOf(text, inner.range)).toEqual(['INNER']);
    expect(inner.paths).toEqual(['inner', 'outer']);
  });

  it('a clip fragment left holding only terminators is dropped, but a whole terminator-only region is kept', () => {
    // the D13 clip above leaves the inserted '\n' before OUTER-A stranded: it
    // could only claim the marker's line, and its path rides the new region.
    const clipped = createSpyScope();
    const clipBuilder = createPatchBuilder(clipped, 'head\nMARK\ntail');
    clipped.read('outer');
    clipBuilder.insertAfterExact('MARK', '\nOUTER-A\nOUTER-B');
    clipped.read('inner');
    clipBuilder.replaceExact('OUTER-A', 'INNER');
    const clippedText = clipBuilder.text();
    expect(clipped.ranges).toHaveLength(2);
    expect(clipped.ranges.map((entry) => linesOf(clippedText, entry.range))).toEqual([
      ['OUTER-B'],
      ['INNER'],
    ]);
    expect(clipped.ranges.map((entry) => entry.paths)).toEqual([['outer'], ['inner', 'outer']]);
    expect(clipped.ranges.some((entry) => linesOf(clippedText, entry.range).includes('MARK'))).toBe(
      false
    );

    // an emission that is genuinely terminator-only still attributes to its own line
    const whole = createSpyScope();
    const wholeBuilder = createPatchBuilder(whole, 'head\nMARK\ntail');
    whole.read('blank');
    wholeBuilder.insertAfterExact('MARK', '\n');
    const wholeText = wholeBuilder.text();
    expect(whole.ranges).toHaveLength(1);
    expect(linesOf(wholeText, whole.ranges[0]?.range ?? { start: 0, end: 0 })).toEqual(['MARK']);
    expect(whole.ranges[0]?.paths).toEqual(['blank']);
  });

  it('only the first occurrence of a repeated search is edited and attributed', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, 'dup\nmiddle\ndup');
    scope.read('p');
    builder.replaceExact('dup', 'CHANGED');
    const text = builder.text();
    expect(text).toBe('CHANGED\nmiddle\ndup');
    expect(linesOf(text, scope.ranges[0]?.range ?? { start: 0, end: 0 })).toEqual(['CHANGED']);
  });

  it('a pure upstream repair records no range; the same repair with explicit paths records one', () => {
    const plain = createSpyScope();
    const repaired = createPatchBuilder(plain, SOURCE);
    repaired.replaceExact('mod contract {', 'mod contract {');
    repaired.text();
    expect(plain.ranges).toEqual([]);

    const explicit = createSpyScope();
    const tagged = createPatchBuilder(explicit, SOURCE);
    tagged.replaceExact('mod contract {', 'mod contract {', ['explicit']);
    tagged.text();
    expect(explicit.ranges).toHaveLength(1);
  });
});

describe('INV-23 — every addRange is deferred to text()', () => {
  it('no range is recorded before text(), and each region is recorded once across two calls', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, SOURCE);
    scope.read('a');
    builder.insertAfterExact('    // roles', '\n    // A');
    scope.read('b');
    builder.insertAfterExact('mod contract {', '\n    // B');
    expect(scope.calls.filter((c) => c.kind === 'addRange')).toHaveLength(0);
    const first = builder.text();
    const second = builder.text();
    expect(first).toBe(second);
    expect(scope.ranges).toHaveLength(2);
  });

  it('ranges are passed in region insertion order', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, 'a\nb\nc');
    scope.read('late');
    builder.replaceExact('c', 'C');
    scope.read('early');
    builder.replaceExact('a', 'A');
    builder.text();
    expect(scope.ranges.map((entry) => entry.paths)).toEqual([['late'], ['early']]);
  });

  it('trailing reads at text() attribute to no region', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, SOURCE);
    scope.read('late');
    expect(builder.text()).toBe(SOURCE);
    expect(scope.ranges).toEqual([]);
  });
});

describe('INV-10 / INV-16 — error semantics and atomicity', () => {
  it('a missing snippet propagates the core error unchanged and moves nothing', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, SOURCE);
    scope.read('kept');
    expect(() => builder.insertAfterExact('ABSENT', 'x')).toThrow(
      'Expected source snippet was not found'
    );
    expect(builder.current).toBe(SOURCE);
    // the window was not consumed: the next successful edit carries it
    builder.insertAfterExact('    // roles', '\n    // A');
    builder.text();
    expect(scope.ranges[0]?.paths).toEqual(['kept']);
  });

  it('the missing-snippet error is a plain Error, not an attribution error', () => {
    const builder = createPatchBuilder(createSpyScope(), SOURCE);
    let caught: unknown;
    try {
      builder.replaceExact('ABSENT', 'x');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(ProvenanceAttributionError);
  });

  it.each(['replaceExact', 'insertBeforeExact', 'insertAfterExact', 'observe'] as const)(
    '%s after text() throws emit-after-text without touching the scope',
    (method) => {
      const scope = createSpyScope();
      const builder = createPatchBuilder(scope, SOURCE);
      builder.text();
      const before = scope.calls.length;
      let caught: unknown;
      try {
        if (method === 'replaceExact') builder.replaceExact('mod', 'MOD');
        if (method === 'insertBeforeExact') builder.insertBeforeExact('mod', 'x');
        if (method === 'insertAfterExact') builder.insertAfterExact('mod', 'x');
        if (method === 'observe') builder.observe(() => 1);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ProvenanceAttributionError);
      expect((caught as ProvenanceAttributionError).reason).toBe('emit-after-text');
      expect(scope.calls.length).toBe(before);
      expect(builder.current).toBe(SOURCE);
    }
  );

  it('a builder cannot be bound to a scope that already has a line builder', () => {
    const scope = createSpyScope();
    createPatchBuilder(scope, SOURCE);
    expect(() => createPatchBuilder(scope, SOURCE)).toThrow(ProvenanceAttributionError);
  });

  it('a read before construction is refused, naming the paths', () => {
    const scope = createSpyScope();
    scope.read('settings.decimals');
    expect(() => createPatchBuilder(scope, SOURCE)).toThrow(/settings\.decimals/);
  });
});

describe('INV-19 / INV-24 — disabled parity and observability', () => {
  const script = (scope: ReturnType<typeof createSpyScope>): string => {
    const builder = createPatchBuilder(scope, SOURCE);
    scope.read('a');
    builder.replaceExact('7', '18');
    scope.read('b');
    builder.insertAfterExact('    // roles', '\n    // A');
    builder.insertBeforeExact('}', '// end\n', ['explicit']);
    return builder.text();
  };

  it('a disabled scope produces identical text and still validates the explicit range', () => {
    const disabled = createSpyScope({ disabled: true });
    expect(script(disabled)).toBe(script(createSpyScope()));
    const added = disabled.calls.filter((c) => c.kind === 'addRange');
    expect(added).toHaveLength(1);
  });

  it('exposes exactly the documented members', () => {
    const builder = createPatchBuilder(createSpyScope(), SOURCE);
    expect(new Set(Object.keys(builder))).toEqual(
      new Set([
        'config',
        'current',
        'replaceExact',
        'insertBeforeExact',
        'insertAfterExact',
        'observe',
        'text',
      ])
    );
  });

  it('observe returns the compute reads and leaves the earlier window pending', () => {
    const scope = createSpyScope();
    const builder = createPatchBuilder(scope, SOURCE);
    scope.read('earlier');
    const observed = builder.observe((config) => {
      scope.read('inside');
      return config.settings.decimals;
    });
    expect(observed.value).toBe(7);
    expect(observed.paths).toEqual(['inside']);
    builder.replaceExact('7', '18', observed.paths);
    builder.text();
    expect(scope.ranges[0]?.paths).toEqual(['earlier', 'inside']);
  });
});
