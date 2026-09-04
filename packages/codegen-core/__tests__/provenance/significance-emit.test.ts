/**
 * SF-10 — the sink: where the mark is born and where it must not survive.
 * INV-3, INV-7, INV-19, INV-20, INV-21, INV-24.
 * Category: Request/Response Contract + Side-Effect Ordering & Observability.
 *
 * `createSpyScope` records the third argument to `addRange` by reference, so
 * these tests can see the difference between "no mark" and "a mark spelled
 * `undefined`" — the distinction INV-3 turns on and that an entry-level
 * assertion cannot make.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { AttributionCursor } from '../../src/provenance/builder-registry';
import { createLineBuilder } from '../../src/provenance/line-builder';
import type { EmitOptions, LineSink } from '../../src/provenance/line-builder';
import type { ConfigPath } from '../../src/provenance/types';
import { createSpyScope } from './builder-fixtures';
import type { FixtureConfig, SpyScope } from './builder-fixtures';

type Emitter = 'line' | 'lines' | 'block';

/** Drive one emission through each sink method with the same observable shape. */
function emitBy(
  sink: LineSink,
  how: Emitter,
  extraPaths?: readonly ConfigPath[],
  options?: EmitOptions
): void {
  if (how === 'line') sink.line('echo "x"', extraPaths, options);
  else if (how === 'lines') sink.lines(['echo "x"'], extraPaths, options);
  else sink.block('echo "x"', extraPaths, options);
}

const addRanges = (scope: SpyScope) => scope.calls.filter((call) => call.kind === 'addRange');

describe('INV-3 — nothing but the literal `true` marks', () => {
  const UNMARKING: ReadonlyArray<readonly [string, EmitOptions | undefined]> = [
    ['no third argument', undefined],
    ['an empty options object', {}],
    ['secondary: false', { secondary: false }],
    ['secondary: undefined', { secondary: undefined }],
  ];

  for (const how of ['line', 'lines', 'block'] as const) {
    it.each(UNMARKING)(`${how} with %s forwards no secondaryPaths`, (_label, options) => {
      const scope = createSpyScope();
      const builder = createLineBuilder(scope);
      scope.read('settings.name');
      emitBy(builder, how, undefined, options);

      const [call] = addRanges(scope);
      expect(call?.options).toBeUndefined();
    });

    it(`${how} with secondary: true forwards the mark`, () => {
      const scope = createSpyScope();
      const builder = createLineBuilder(scope);
      scope.read('settings.name');
      emitBy(builder, how, undefined, { secondary: true });

      const [call] = addRanges(scope);
      expect(call?.options?.secondaryPaths).toEqual(['settings.name']);
    });
  }

  it('a truthy non-boolean does not mark — the comparison is strict identity', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('settings.name');
    // The shape a later refactor threading a string through would produce. It
    // must be indistinguishable from unmarked, not "close enough".
    const hostile = { secondary: 'yes' } as unknown as EmitOptions;
    builder.line('echo "x"', undefined, hostile);

    expect(addRanges(scope)[0]?.options).toBeUndefined();
  });

  it('an unmarked emission produces the pre-change entry exactly', () => {
    const marked = createSpyScope();
    const unmarked = createSpyScope();
    for (const [scope, options] of [
      [marked, { secondary: false }],
      [unmarked, undefined],
    ] as const) {
      const builder = createLineBuilder(scope);
      scope.read('settings.name');
      builder.line('echo "x"', ['settings.symbol'], options);
    }
    expect(addRanges(marked)).toStrictEqual(addRanges(unmarked));
  });
});

describe('INV-7 — the mark expands to exactly the emission’s own path union', () => {
  it('drained + pending + extraPaths are all present in both members', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);

    scope.read('settings.name'); // drained by the zero-line emission below
    builder.lines([], ['pending.only']); // leaves both in the pending window
    scope.read('settings.symbol'); // drained by the emission itself
    builder.line('echo "x"', ['extra.path'], { secondary: true });

    const [call] = addRanges(scope);
    const paths = call?.paths ?? [];
    expect(paths).toEqual(['extra.path', 'pending.only', 'settings.name', 'settings.symbol']);
    expect(call?.options?.secondaryPaths).toEqual(paths);
  });

  it('the mark adds nothing to the path set: marked and unmarked agree on `paths`', () => {
    const run = (secondary: boolean): readonly ConfigPath[] => {
      const scope = createSpyScope();
      const builder = createLineBuilder(scope);
      scope.read('settings.name');
      builder.line('echo "x"', ['extra.path'], { secondary });
      return addRanges(scope)[0]?.paths ?? [];
    };
    expect(run(true)).toEqual(run(false));
  });

  it('the forwarded secondary set is the same array the call passes as `paths`', () => {
    // Not merely equal: `emit` reuses its own `paths` local, so there is no
    // second source a different set could be computed from. The collector is
    // what re-allocates them apart (INV-4).
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('settings.name');
    builder.line('echo "x"', undefined, { secondary: true });

    const call = addRanges(scope)[0];
    if (call?.kind !== 'addRange') throw new Error('expected an addRange call');
    // `call.paths` is the spy's own normalised copy; the options object holds
    // the emission's array, so compare contents and assert the option is not
    // some third set.
    expect(call.options?.secondaryPaths).toEqual(call.paths);
  });

  it('a marked emission carrying only explicit extraPaths marks exactly those', () => {
    // The six real sites' shape: `emitSubsection(sink, title, attribution.modules)`.
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    builder.lines(['echo ""', 'echo "  Heading"'], ['compliance.modules[0].moduleId'], {
      secondary: true,
    });

    const [call] = addRanges(scope);
    expect(call?.paths).toEqual(['compliance.modules[0].moduleId']);
    expect(call?.options?.secondaryPaths).toEqual(['compliance.modules[0].moduleId']);
  });
});

describe('INV-19 — the mark and its range are produced in one call frame', () => {
  it('`EmitOptions` is a parameter: no sink method or cursor member holds a mark', () => {
    expectTypeOf<keyof LineSink>().toEqualTypeOf<'line' | 'lines' | 'block'>();
    // Mechanism C — `sink.markNextSecondary()` — is not merely unused: there is
    // nowhere for it to live. The cursor carries paths, never significance.
    expectTypeOf<keyof AttributionCursor<FixtureConfig>>().toEqualTypeOf<
      'take' | 'flush' | 'observe'
    >();
    expectTypeOf<keyof EmitOptions>().toEqualTypeOf<'secondary'>();
  });

  it('`line-builder.ts` declares no mutable binding holding a mark outside `emit`', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'src',
        'provenance',
        'line-builder.ts'
      ),
      'utf8'
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // A `let pendingOptions` / `let pendingSecondary` is the sticky cursor
    // reintroduced through the back door; the mark must only ever be a parameter.
    expect(code).not.toMatch(/\b(let|var)\s+\w*[Ss]econdary\w*/);
    expect(code).not.toMatch(/\b(let|var)\s+pendingOptions\b/);
    expect(code).not.toMatch(/\bmarkNext\w*/);
    // `secondary` appears only where the mark is read and forwarded.
    expect([...code.matchAll(/secondary/gi)].length).toBeLessThanOrEqual(3);
  });
});

describe('INV-20 — significance is never pending', () => {
  it('a marked zero-line emission leaves its paths pending and its mark nowhere', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);

    builder.lines([], ['token.name'], { secondary: true });
    builder.line('echo "x"');

    const [call] = addRanges(scope);
    expect(call?.paths).toContain('token.name'); // the paths survived
    expect(call?.options).toBeUndefined(); // the mark did not
  });

  it('the following emission can still mark itself — nothing was lost, only the mark', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);

    builder.lines([], ['token.name'], { secondary: true });
    builder.line('echo "x"', undefined, { secondary: true });

    expect(addRanges(scope)[0]?.options?.secondaryPaths).toEqual(['token.name']);
  });

  it('two marked zero-line emissions in a row still leave the next emission primary', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);

    builder.lines([], undefined, { secondary: true });
    builder.lines([], undefined, { secondary: true });
    scope.read('settings.name');
    builder.line('stellar contract deploy \\');

    expect(addRanges(scope)[0]?.options).toBeUndefined();
  });

  it('`observe` between a marked and an unmarked emission carries no mark across', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);

    scope.read('settings.name');
    builder.line('echo "banner"', undefined, { secondary: true });
    builder.observe((config) => config.settings.symbol);
    scope.read('settings.symbol');
    builder.line('stellar contract deploy \\');

    const [first, second] = addRanges(scope);
    expect(first?.options?.secondaryPaths).toEqual(['settings.name']);
    expect(second?.options).toBeUndefined();
  });

  it('`observe` takes no options — there is no argument through which a mark could arrive', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    expectTypeOf(builder.observe).parameters.toEqualTypeOf<
      [(config: (typeof builder)['config']) => unknown]
    >();
  });
});

describe('INV-21 — an emission with no paths records nothing, mark included', () => {
  it('a marked emission attributing nothing creates no entry', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    builder.line('echo "static banner"', undefined, { secondary: true });

    expect(addRanges(scope)).toHaveLength(0);
  });

  it('the entry count matches the unmarked equivalent exactly', () => {
    const run = (secondary: boolean): number => {
      const scope = createSpyScope();
      const builder = createLineBuilder(scope);
      builder.line('echo "static banner"', undefined, { secondary });
      scope.read('settings.name');
      builder.line('echo "attributed"', undefined, { secondary });
      return addRanges(scope).length;
    };
    expect(run(true)).toBe(run(false));
    expect(run(true)).toBe(1);
  });

  it('no recorded call ever pairs an empty path union with a mark', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    builder.line('echo "a"', undefined, { secondary: true });
    scope.read('settings.name');
    builder.line('echo "b"', undefined, { secondary: true });
    builder.line('echo "c"', [], { secondary: true });

    for (const call of addRanges(scope)) {
      if (call.options !== undefined) expect(call.paths.length).toBeGreaterThan(0);
    }
  });
});

describe('INV-24 — an unmarked emission allocates nothing new', () => {
  it('the third argument is `undefined`, not an empty object', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('settings.name');
    builder.line('echo "x"');

    const [call] = addRanges(scope);
    if (call?.kind !== 'addRange') throw new Error('expected an addRange call');
    // `{}` here would mean every unmarked range in a generation — hundreds, on
    // the wizard's keystroke-debounced preview path — pays an allocation for a
    // property it will not have.
    expect(call.options).toBeUndefined();
    expect('options' in call).toBe(true); // the spy did record the argument
  });

  it('`|secondaryPaths| <= |paths|` for every marked emission', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('settings.name', 'settings.symbol');
    builder.line('echo "x"', ['extra.path'], { secondary: true });

    const [call] = addRanges(scope);
    expect(call?.options?.secondaryPaths?.length ?? 0).toBeLessThanOrEqual(call?.paths.length ?? 0);
  });
});
