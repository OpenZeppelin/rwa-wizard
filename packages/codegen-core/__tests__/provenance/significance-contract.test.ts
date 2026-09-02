/**
 * SF-10 — the recorded shape of a significance mark.
 * INV-1, INV-2, INV-4, INV-8, INV-34 (expressibility).
 * Category: Request/Response Contract.
 *
 * Everything here goes through the real collector rather than a hand-built
 * entry, because the invariants are about what `addRange` may *produce*: a
 * literal is free to spell a state the collector can never reach.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { AddRangeOptions } from '../../src/provenance/provenance-collector';
import { createProvenanceCollector } from '../../src/provenance/provenance-collector';
import type { ConfigPath, ProvenanceEntry, ProvenanceResult } from '../../src/provenance/types';

interface Cfg {
  readonly token: { readonly name: string; readonly symbol: string };
}
const CONFIG: Cfg = { token: { name: 'Alpha', symbol: 'ALP' } };

const FILE = 'out/deploy.sh';

type RangeEntry = Extract<ProvenanceEntry, { kind: 'range' }>;

/** Record one file with one `addRange` call and return its assembled entries. */
function recordOneRange(
  paths: readonly ConfigPath[],
  options?: AddRangeOptions
): readonly ProvenanceEntry[] {
  const collector = createProvenanceCollector(CONFIG, { enabled: true });
  collector.record(FILE, (scope) => {
    scope.addRange({ start: 1, end: 3 }, paths, options);
  });
  const result = collector.result();
  if (result === undefined) throw new Error('expected a result');
  return result.files[FILE]?.entries ?? [];
}

const rangesOf = (entries: readonly ProvenanceEntry[]): readonly RangeEntry[] =>
  entries.filter((entry): entry is RangeEntry => entry.kind === 'range');

const onlyRange = (entries: readonly ProvenanceEntry[]): RangeEntry => {
  const [range, ...rest] = rangesOf(entries);
  if (range === undefined || rest.length > 0) {
    throw new Error(`expected exactly one range entry, got ${rangesOf(entries).length}`);
  }
  return range;
};

/** `Object.hasOwn` is ES2022 and banned in `src/`; tests may use the ES2020 spelling. */
const hasKey = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

describe('INV-1 — canonical form: absent, or a non-empty sorted deduped subset', () => {
  it('an unmarked range omits the key entirely — no `undefined` spelling', () => {
    const entry = onlyRange(recordOneRange(['token.name']));
    expect(hasKey(entry, 'secondaryPaths')).toBe(false);
    // toStrictEqual is the assertion that matters: `{ secondaryPaths: undefined }`
    // passes toEqual and fails here, and it is the spelling that would make every
    // pre-SF-10 comparison in SF-1/2/3's suites fail.
    expect(entry).toStrictEqual({
      kind: 'range',
      range: { start: 1, end: 3 },
      paths: ['token.name'],
    });
  });

  it('`secondaryPaths: []` records the same object as no options at all', () => {
    const marked = onlyRange(recordOneRange(['token.name'], { secondaryPaths: [] }));
    const unmarked = onlyRange(recordOneRange(['token.name']));
    expect(hasKey(marked, 'secondaryPaths')).toBe(false);
    expect(marked).toStrictEqual(unmarked);
  });

  it('an empty options object records the same object as no options at all', () => {
    const marked = onlyRange(recordOneRange(['token.name'], {}));
    expect(marked).toStrictEqual(onlyRange(recordOneRange(['token.name'])));
  });

  it('a declared set is sorted and deduped against unsorted duplicate input', () => {
    const entry = onlyRange(
      recordOneRange(['token.name', 'token.symbol'], {
        secondaryPaths: ['token.symbol', 'token.name', 'token.symbol'],
      })
    );
    expect(entry.secondaryPaths).toEqual(['token.name', 'token.symbol']);
  });

  it('the fully-secondary case is accepted and deep-equals `paths`', () => {
    const entry = onlyRange(
      recordOneRange(['token.name', 'token.symbol'], {
        secondaryPaths: ['token.name', 'token.symbol'],
      })
    );
    expect(entry.secondaryPaths).toEqual(entry.paths);
  });

  it('a proper subset is accepted — the mixed-significance shape (INV-34, expressible)', () => {
    const entry = onlyRange(
      recordOneRange(['token.name', 'token.symbol'], { secondaryPaths: ['token.symbol'] })
    );
    expect(entry.secondaryPaths).toEqual(['token.symbol']);
    expect(entry.paths).toEqual(['token.name', 'token.symbol']);
  });

  it('length is in [1, paths.length] whenever the key is present', () => {
    for (const declared of [['token.name'], ['token.name', 'token.symbol']]) {
      const entry = onlyRange(
        recordOneRange(['token.name', 'token.symbol'], { secondaryPaths: declared })
      );
      const secondary = entry.secondaryPaths;
      if (secondary === undefined) throw new Error('expected a mark');
      expect(secondary.length).toBeGreaterThanOrEqual(1);
      expect(secondary.length).toBeLessThanOrEqual(entry.paths.length);
    }
  });

  it('duplicates that collapse to one path still record a non-empty set', () => {
    const entry = onlyRange(
      recordOneRange(['token.name'], { secondaryPaths: ['token.name', 'token.name'] })
    );
    expect(entry.secondaryPaths).toEqual(['token.name']);
  });
});

describe('INV-2 — significance rides `range` entries only', () => {
  it('a file whose every range is marked still has an unmarked `file` entry holding the union', () => {
    const collector = createProvenanceCollector(CONFIG, { enabled: true });
    collector.record(FILE, (scope) => {
      scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['token.name'] });
      scope.addRange({ start: 2, end: 2 }, ['token.symbol'], { secondaryPaths: ['token.symbol'] });
    });
    const result = collector.result();
    const entries = result?.files[FILE]?.entries ?? [];
    const fileEntry = entries.find((entry) => entry.kind === 'file');
    if (fileEntry === undefined) throw new Error('expected a file entry');

    expect(fileEntry.paths).toEqual(['token.name', 'token.symbol']);
    expect(hasKey(fileEntry, 'secondaryPaths')).toBe(false);
    expect(fileEntry).toStrictEqual({ kind: 'file', paths: ['token.name', 'token.symbol'] });
  });

  it('a `created` entry never carries the key, even beside a fully marked range', () => {
    const collector = createProvenanceCollector(CONFIG, { enabled: true });
    collector.record(
      FILE,
      (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['token.name'] });
      },
      { createdBy: ['token.symbol'] }
    );
    const created = (collector.result()?.files[FILE]?.entries ?? []).find(
      (entry) => entry.kind === 'created'
    );
    if (created === undefined) throw new Error('expected a created entry');
    expect(created).toStrictEqual({ kind: 'created', paths: ['token.symbol'] });
  });

  it('`RecordOptions` exposes no argument through which a `created` mark could arrive', () => {
    // The type-level half of the same invariant: there is no writer, not merely
    // no caller. Runtime cannot observe an argument that does not exist.
    expectTypeOf<keyof Extract<ProvenanceEntry, { kind: 'created' }>>().toEqualTypeOf<
      'kind' | 'paths'
    >();
    expectTypeOf<keyof Extract<ProvenanceEntry, { kind: 'file' }>>().toEqualTypeOf<
      'kind' | 'paths'
    >();
  });
});

describe('INV-4 — entry arrays are fresh and mutually independent', () => {
  it('passing ONE array as both arguments still yields two collector-owned arrays', () => {
    // This is exactly the shape `emit` produces: `{ secondaryPaths: paths }`.
    const shared: ConfigPath[] = ['token.name', 'token.symbol'];
    const collector = createProvenanceCollector(CONFIG, { enabled: true });
    collector.record(FILE, (scope) => {
      scope.addRange({ start: 1, end: 1 }, shared, { secondaryPaths: shared });
    });
    const entry = onlyRange(collector.result()?.files[FILE]?.entries ?? []);

    expect(entry.paths).not.toBe(shared);
    expect(entry.secondaryPaths).not.toBe(shared);
    expect(entry.secondaryPaths).not.toBe(entry.paths);
    expect(entry.secondaryPaths).toEqual(entry.paths);
  });

  it('mutating the caller-held array afterwards changes nothing recorded', () => {
    const shared: ConfigPath[] = ['token.name'];
    const collector = createProvenanceCollector(CONFIG, { enabled: true });
    collector.record(FILE, (scope) => {
      scope.addRange({ start: 1, end: 1 }, shared, { secondaryPaths: shared });
    });
    shared.push('token.symbol');
    const entry = onlyRange(collector.result()?.files[FILE]?.entries ?? []);
    expect(entry.paths).toEqual(['token.name']);
    expect(entry.secondaryPaths).toEqual(['token.name']);
  });

  it('the range object is copied, as it already was', () => {
    const range = { start: 1, end: 2 };
    const collector = createProvenanceCollector(CONFIG, { enabled: true });
    collector.record(FILE, (scope) => {
      scope.addRange(range, ['token.name'], { secondaryPaths: ['token.name'] });
    });
    const entry = onlyRange(collector.result()?.files[FILE]?.entries ?? []);
    expect(entry.range).not.toBe(range);
    expect(entry.range).toEqual({ start: 1, end: 2 });
  });
});

describe('INV-8 — strictly additive', () => {
  it('the legacy two-argument `addRange` call still compiles and records unmarked', () => {
    const collector = createProvenanceCollector(CONFIG, { enabled: true });
    collector.record(FILE, (scope) => {
      scope.addRange({ start: 1, end: 1 }, ['token.name']);
    });
    expect(onlyRange(collector.result()?.files[FILE]?.entries ?? [])).toStrictEqual({
      kind: 'range',
      range: { start: 1, end: 1 },
      paths: ['token.name'],
    });
  });

  it('a generator that passes no options anywhere produces the pre-change object exactly', () => {
    // The "unmarking generator" comparison: the same recording driven twice, once
    // through the legacy arity and once through `undefined` options, must be
    // indistinguishable — including by toStrictEqual, which sees an `undefined`
    // key that toEqual would forgive.
    const legacy = recordOneRange(['token.name', 'token.symbol']);
    const explicitUndefined = recordOneRange(['token.name', 'token.symbol'], undefined);
    const emptyOptions = recordOneRange(['token.name', 'token.symbol'], {});
    const undefinedMember = recordOneRange(['token.name', 'token.symbol'], {
      secondaryPaths: undefined,
    });
    expect(explicitUndefined).toStrictEqual(legacy);
    expect(emptyOptions).toStrictEqual(legacy);
    expect(undefinedMember).toStrictEqual(legacy);
  });

  it('every new member is optional at the type level', () => {
    expectTypeOf<AddRangeOptions['secondaryPaths']>().toEqualTypeOf<
      readonly ConfigPath[] | undefined
    >();
    // A pre-change entry literal is still assignable — no required member appeared.
    const preChange: ProvenanceEntry = {
      kind: 'range',
      range: { start: 1, end: 1 },
      paths: ['token.name'],
    };
    const preChangeResult: ProvenanceResult = { files: { [FILE]: { entries: [preChange] } } };
    expect(preChangeResult.files[FILE]?.entries).toHaveLength(1);
  });
});
