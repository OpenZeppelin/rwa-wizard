/**
 * Rev 2 (D17): report-time prefix pruning — traversal vs terminal classification.
 * INV-35 (the full post-prune table, one test per row), the classification-map
 * memo-key rule (three inputs), INV-13 rev 2 (window split drain-vs-all),
 * INV-7 rev 2 (external arrays never pruned), and the additive
 * `ProvenanceScope.filePath`.
 * Category: Request/Response + Idempotency.
 */
import { describe, expect, it } from 'vitest';

import { createConfigRecorder } from '../../src/provenance/config-recorder';
import { createProvenanceCollector } from '../../src/provenance/provenance-collector';
import { filterProvenanceByPath } from '../../src/provenance/provenance-result';
import type { ProvenanceResult } from '../../src/provenance/types';

interface Cfg {
  a: { b: string; c?: { d: number } };
  o: { k1: string; k2: { deep: boolean } };
  token: { name: string; symbol: string };
  arr: Array<{ id: string; address: string }>;
  prims: number[];
}

const make = (): Cfg => ({
  a: { b: 'B' },
  o: { k1: 'K1', k2: { deep: true } },
  token: { name: 'N', symbol: 'S' },
  arr: [
    { id: 'i0', address: 'A0' },
    { id: 'i1', address: 'A1' },
  ],
  prims: [7, 8],
});

function requireResult(result: ProvenanceResult | undefined): ProvenanceResult {
  if (result === undefined) throw new Error('expected an enabled collector to produce a result');
  return result;
}

describe('INV-35 — post-prune table (one test per D17 row, exact reported drain())', () => {
  it("v.a.b (leaf) → ['a.b']", () => {
    const r = createConfigRecorder(make());
    expect(r.view.a.b).toBe('B');
    expect(r.drain()).toEqual(['a.b']);
  });

  it("v.a?.c?.d with a.c absent → ['a.c'] (traversal `a` pruned; absent child is terminal)", () => {
    const r = createConfigRecorder(make());
    expect(r.view.a?.c?.d).toBeUndefined();
    expect(r.drain()).toEqual(['a.c']);
  });

  it("if (v.a) with no further read → ['a'] (traversal with no descendant is kept)", () => {
    const r = createConfigRecorder(make());
    if (r.view.a) expect(true).toBe(true);
    expect(r.drain()).toEqual(['a']);
  });

  it("Array.isArray(v.arr) alone → ['arr']", () => {
    const r = createConfigRecorder(make());
    expect(Array.isArray(r.view.arr)).toBe(true);
    expect(r.drain()).toEqual(['arr']);
  });

  it("const t = v.a with no further read → ['a']", () => {
    const r = createConfigRecorder(make());
    const t = r.view.a;
    expect(typeof t).toBe('object');
    expect(r.drain()).toEqual(['a']);
  });

  // INV-35 table row 4 reads "v.token.name then if (v.token)". Under the invariant's own
  // classification `if (v.token)` is a `get` returning a child view — a traversal, exactly like
  // the first step of `v.token.name` — so that literal row cannot report `token` (see row 3 and
  // Dev Notes / Open Q1 in 05-tests.md). The property the row wants — terminal overrides
  // traversal for the same path in the same window — is asserted with genuinely terminal reads.
  it("v.token.name then Reflect.ownKeys(v.token) in the same window → ['token','token.name'] (terminal overrides traversal)", () => {
    const r = createConfigRecorder(make());
    void r.view.token.name;
    void Reflect.ownKeys(r.view.token);
    expect(r.drain()).toEqual(['token', 'token.name']);
  });

  it("v.token.name then 'x' in v.token.name's parent via has on the ROOT ('token' in v) → ['token','token.name']", () => {
    const r = createConfigRecorder(make());
    void r.view.token.name;
    expect('token' in r.view).toBe(true);
    expect(r.drain()).toEqual(['token', 'token.name']);
  });

  it('a later traversal never downgrades a terminal: Reflect.ownKeys(v.token) then v.token.name → both kept', () => {
    const r = createConfigRecorder(make());
    void Reflect.ownKeys(r.view.token);
    void r.view.token.name;
    expect(r.drain()).toEqual(['token', 'token.name']);
  });

  it("v.token.name then if (v.token) → ['token.name'] (the literal INV-35 row-4 shape: both are traversals of token)", () => {
    const r = createConfigRecorder(make());
    void r.view.token.name;
    if (r.view.token) expect(true).toBe(true);
    expect(r.drain()).toEqual(['token.name']);
  });

  it("'name' in v.token (has → terminal on token.name) then v.token.symbol → ['token.name','token.symbol']", () => {
    const r = createConfigRecorder(make());
    expect('name' in r.view.token).toBe(true);
    void r.view.token.symbol;
    expect(r.drain()).toEqual(['token.name', 'token.symbol']);
  });

  it("Reflect.ownKeys(v.o) → ['o']", () => {
    const r = createConfigRecorder(make());
    expect(Reflect.ownKeys(r.view.o)).toEqual(['k1', 'k2']);
    expect(r.drain()).toEqual(['o']);
  });

  it.each<[string, (v: Cfg) => void]>([
    ['Object.keys(v.o)', (v) => void Object.keys(v.o)],
    ['{...v.o}', (v) => void { ...v.o }],
    ['Object.entries(v.o)', (v) => void Object.entries(v.o)],
    [
      'for…in v.o',
      (v) => {
        for (const k in v.o) void k;
      },
    ],
  ])(
    '%s → o and each o.<k> (descriptor reads are terminal; o kept beside children)',
    (_label, read) => {
      const r = createConfigRecorder(make());
      read(r.view);
      const drained = r.drain();
      expect(drained[0]).toBe('o');
      expect(drained).toContain('o.k1');
      expect(drained).toContain('o.k2');
      // Object.entries / spread also `get` each value: k2 is a traversal with no descendant → kept
      expect(drained).not.toContain('o.k2.deep');
    }
  );

  it('JSON.stringify(v.o) → o, every nested object path, every leaf', () => {
    const r = createConfigRecorder(make());
    JSON.stringify(r.view.o);
    expect(r.drain()).toEqual(['o', 'o.k1', 'o.k2', 'o.k2.deep']);
  });

  it("JSON.stringify(v) → '' plus every object path and leaf; '' present", () => {
    const r = createConfigRecorder(make());
    JSON.stringify(r.view);
    const drained = r.drain();
    expect(drained[0]).toBe('');
    for (const p of [
      'a',
      'a.b',
      'o',
      'o.k1',
      'o.k2',
      'o.k2.deep',
      'token',
      'token.name',
      'arr',
      'arr[0]',
      'arr[0].id',
      'prims',
      'prims[1]',
    ]) {
      expect(drained, p).toContain(p);
    }
  });

  it("v.arr[1].address → ['arr[1].address']", () => {
    const r = createConfigRecorder(make());
    void r.view.arr[1]?.address;
    expect(r.drain()).toEqual(['arr[1].address']);
  });

  it('v.arr.map(x => x.id) → arr plus arr[i].id, no bare arr[i]', () => {
    const r = createConfigRecorder(make());
    expect(r.view.arr.map((x) => x.id)).toEqual(['i0', 'i1']);
    expect(r.drain()).toEqual(['arr', 'arr[0].id', 'arr[1].id']);
  });

  it('for…of reading a leaf → arr plus arr[i].address, no bare arr[i]', () => {
    const r = createConfigRecorder(make());
    for (const x of r.view.arr) void x.address;
    expect(r.drain()).toEqual(['arr', 'arr[0].address', 'arr[1].address']);
  });

  it('for…of obtaining elements without reading into them → arr and every bare arr[i]', () => {
    const r = createConfigRecorder(make());
    for (const x of r.view.arr) void x;
    expect(r.drain()).toEqual(['arr', 'arr[0]', 'arr[1]']);
  });

  it('[...v.prims] on primitives → prims plus every prims[i] (primitive elements are terminal)', () => {
    const r = createConfigRecorder(make());
    expect([...r.view.prims]).toEqual([7, 8]);
    expect(r.drain()).toEqual(['prims', 'prims[0]', 'prims[1]']);
  });

  it('Object.keys(v.arr) / {...v.arr} → arr and every arr[i]', () => {
    const r = createConfigRecorder(make());
    expect(Object.keys(r.view.arr)).toEqual(['0', '1']);
    expect(r.drain()).toEqual(['arr', 'arr[0]', 'arr[1]']);
    void { ...r.view.arr };
    expect(r.drain()).toEqual(['arr', 'arr[0]', 'arr[1]']);
  });

  it("new Set(v.arr.map(m => m.id)) → ['arr','arr[0].id','arr[1].id']", () => {
    const r = createConfigRecorder(make());
    expect(new Set(r.view.arr.map((m) => m.id)).size).toBe(2);
    expect(r.drain()).toEqual(['arr', 'arr[0].id', 'arr[1].id']);
  });

  it('a non-plain value at the end of a chain is terminal: v.o.k2 returned raw would be kept — Date case', () => {
    const cfg = { holder: { when: new Date(0) } };
    const r = createConfigRecorder(cfg);
    expect(r.view.holder.when.getTime()).toBe(0);
    expect(r.drain()).toEqual(['holder.when']);
  });

  it("the root '' is only recorded terminally and never pruned", () => {
    const r = createConfigRecorder(make());
    void Object.keys(r.view);
    void r.view.a.b;
    expect(r.drain()).toContain('');
    expect(r.drain()).toEqual([]);
    void Reflect.ownKeys(r.view);
    expect(r.drain()).toEqual(['']);
  });

  it('pruning is segment-boundary strict: token.nameX is not a descendant of token.name', () => {
    const cfg = { token: { name: { first: 'F' }, nameX: 'X' } };
    const r = createConfigRecorder(cfg);
    void r.view.token.name; // traversal
    void r.view.token.nameX; // terminal, sibling — must not prune token.name
    expect(r.drain()).toEqual(['token.name', 'token.nameX']);
  });
});

describe('INV-35 — classification-map memo-key rule (three inputs)', () => {
  it("(a) classification: v.token alone → ['token']; Object.keys(v.token) → token kept beside children", () => {
    const solo = createConfigRecorder(make());
    void solo.view.token;
    expect(solo.drain()).toEqual(['token']);

    const keys = createConfigRecorder(make());
    void Object.keys(keys.view.token);
    expect(keys.drain()).toEqual(['token', 'token.name', 'token.symbol']);
  });

  it("(b) descendant presence: v.token.name → ['token.name']; v.token.name then a terminal read of token → ['token','token.name']", () => {
    const leaf = createConfigRecorder(make());
    void leaf.view.token.name;
    expect(leaf.drain()).toEqual(['token.name']);

    const both = createConfigRecorder(make());
    void both.view.token.name;
    void Reflect.ownKeys(both.view.token);
    expect(both.drain()).toEqual(['token', 'token.name']);
  });

  it("(c) window boundary: v.token → drain ['token']; v.token.name → drain ['token.name']; all() → ['token.name']", () => {
    const r = createConfigRecorder(make());
    void r.view.token;
    expect(r.drain()).toEqual(['token']);
    void r.view.token.name;
    expect(r.drain()).toEqual(['token.name']);
    expect(r.all()).toEqual(['token.name']);
  });
});

describe('INV-13 rev 2 — all() is the prune of the union of recorded windows, not the union of drains', () => {
  it('a traversal reported in window 1 is collapsed in all() once its leaf is read in window 2', () => {
    const r = createConfigRecorder(make());
    void r.view.a;
    const w1 = r.drain();
    void r.view.a.b;
    const w2 = r.drain();
    expect(w1).toEqual(['a']);
    expect(w2).toEqual(['a.b']);
    expect(r.all()).toEqual(['a.b']);
    expect(r.all().length).toBeLessThan([...w1, ...w2].length);
  });

  it('a terminal in window 1 survives all() even when a descendant is read in window 2', () => {
    const r = createConfigRecorder(make());
    if (r.view.token) expect(true).toBe(true);
    void Reflect.ownKeys(r.view.token); // terminal on token
    r.drain();
    void r.view.token.name;
    r.drain();
    expect(r.all()).toEqual(['token', 'token.name']);
  });

  it('a terminal classification recorded in window 1 does not leak into window 2 (windows are independent maps)', () => {
    const r = createConfigRecorder(make());
    void Reflect.ownKeys(r.view.token); // token terminal in window 1
    r.drain();
    void r.view.token.name; // token traversal only, in window 2
    expect(r.drain()).toEqual(['token.name']);
  });
});

describe('INV-7 rev 2 — external arrays are normalised, never pruned', () => {
  it("addRange(r, ['token']) plus a scope read of v.token.name → file.paths ['token','token.name']", () => {
    const c = createProvenanceCollector(make(), { enabled: true });
    c.record('f', ({ config, addRange }) => {
      void config.token.name;
      addRange({ start: 1, end: 1 }, ['token']);
    });
    expect(requireResult(c.result()).files['f']?.entries).toEqual([
      { kind: 'file', paths: ['token', 'token.name'] },
      { kind: 'range', range: { start: 1, end: 1 }, paths: ['token'] },
    ]);
  });

  it("createdBy ['token','token.name'] is stored as given (not pruned to the leaf)", () => {
    const c = createProvenanceCollector(make(), { enabled: true });
    c.record('f', () => undefined, { createdBy: ['token.name', 'token'] });
    expect(requireResult(c.result()).files['f']?.entries[1]).toEqual({
      kind: 'created',
      paths: ['token', 'token.name'],
    });
  });

  it('the file entry itself is the pruned all(): scope reads v.token.name → file.paths [token.name]', () => {
    const c = createProvenanceCollector(make(), { enabled: true });
    c.record('f', ({ config }) => void config.token.name);
    expect(requireResult(c.result()).files['f']?.entries).toEqual([
      { kind: 'file', paths: ['token.name'] },
    ]);
  });

  it('observe().paths is pruned too', () => {
    const c = createProvenanceCollector(make(), { enabled: true });
    expect(c.observe((v) => v.a.b).paths).toEqual(['a.b']);
    expect(c.observe((v) => Object.keys(v.token)).paths).toEqual([
      'token',
      'token.name',
      'token.symbol',
    ]);
  });
});

describe('INV-35 — consequences through filterProvenanceByPath (the Docs repro and its counter-case)', () => {
  it("Docs repro: a scope that read only v.token.name filters to {} on 'token.symbol', and to the file on 'token.name' and 'token'", () => {
    const c = createProvenanceCollector(make(), { enabled: true });
    c.createFile('only-name.txt', ({ config }) => `n=${config.token.name}`);
    const result = requireResult(c.result());
    expect(filterProvenanceByPath(result, 'token.symbol').files).toEqual({});
    expect(Object.keys(filterProvenanceByPath(result, 'token.name').files)).toEqual([
      'only-name.txt',
    ]);
    expect(Object.keys(filterProvenanceByPath(result, 'token').files)).toEqual(['only-name.txt']);
  });

  it("object-only read: a scope that read Object.keys(v.token) matches 'token.symbol' and an ABSENT child 'token.decimals'", () => {
    const c = createProvenanceCollector(make(), { enabled: true });
    c.createFile('keys.txt', ({ config }) => Object.keys(config.token).join(','));
    const result = requireResult(c.result());
    expect(Object.keys(filterProvenanceByPath(result, 'token.symbol').files)).toEqual(['keys.txt']);
    expect(Object.keys(filterProvenanceByPath(result, 'token.decimals').files)).toEqual([
      'keys.txt',
    ]);
  });

  it.each<[string, (v: Cfg) => unknown]>([
    ['if (v.token)', (v) => (v.token ? 1 : 0)],
    ['Reflect.ownKeys(v.token)', (v) => Reflect.ownKeys(v.token)],
    ['JSON.stringify(v.token)', (v) => JSON.stringify(v.token)],
  ])("%s alone matches an absent child query 'token.decimals'", (_label, read) => {
    const c = createProvenanceCollector(make(), { enabled: true });
    c.record('f', ({ config }) => void read(config));
    const result = requireResult(c.result());
    expect(Object.keys(filterProvenanceByPath(result, 'token.decimals').files)).toEqual(['f']);
  });

  it('pruning does not happen again downstream: filterProvenanceByPath keeps a hand-built entry with both parent and child', () => {
    const hand: ProvenanceResult = {
      files: { f: { entries: [{ kind: 'file', paths: ['token', 'token.name'] }] } },
    };
    expect(filterProvenanceByPath(hand, 'token').files['f']?.entries[0]?.paths).toEqual([
      'token',
      'token.name',
    ]);
  });
});

describe('ProvenanceScope.filePath (rev 2, additive)', () => {
  it('equals the filePath passed to record / createFile, enabled and disabled', () => {
    for (const enabled of [true, false]) {
      const c = createProvenanceCollector(make(), { enabled });
      let seen: string | undefined;
      c.record('dir/file.txt', (scope) => {
        seen = scope.filePath;
      });
      expect(seen).toBe('dir/file.txt');
      c.createFile('other.txt', (scope) => {
        seen = scope.filePath;
        return '';
      });
      expect(seen).toBe('other.txt');
    }
  });

  it('is readable after the scope closed (a plain string, not a trap) and matches the closed error’s filePath', () => {
    const c = createProvenanceCollector(make(), { enabled: true });
    let leaked: { filePath: string; drain(): string[] } | undefined;
    c.record('f.txt', (scope) => {
      leaked = scope;
    });
    expect(leaked?.filePath).toBe('f.txt');
    let caught: unknown;
    try {
      leaked?.drain();
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ reason: 'closed', filePath: 'f.txt' });
  });
});
