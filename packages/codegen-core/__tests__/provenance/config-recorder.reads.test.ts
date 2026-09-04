/**
 * The recording view's read behaviour: value transparency, serialisation
 * identity, value-independent recording, array rules, noise filter, key
 * fidelity, descriptor truthfulness, frozen/null-prototype inputs.
 * INV-1, INV-3, INV-4, INV-5, INV-24, INV-26, INV-27, INV-29, INV-34.
 * Category: Request/Response Contract.
 */
import { describe, expect, it } from 'vitest';

import { computeConfigHash, stableJsonStringify } from '../../src/determinism';
import { formatConfigPath, parseConfigPath } from '../../src/provenance/config-path';
import { createConfigRecorder } from '../../src/provenance/config-recorder';
import { Counter, createJsonConfig, createSyntheticConfig, deepFreeze } from './fixtures';

const hasOwn = (target: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

describe('INV-1 — the view is the config, typed and shaped', () => {
  it('returns primitives, null, undefined, functions and non-plain objects by identity', () => {
    const config = createSyntheticConfig();
    const { view } = createConfigRecorder(config);

    expect(view.settings.name).toBe(config.settings.name);
    expect(view.settings.decimals).toBe(7);
    expect(view.settings.emptyString).toBe('');
    expect(view.settings.flagOff).toBe(false);
    expect(view.settings.zero).toBe(0);
    expect(view.settings.nothing).toBeNull();
    expect(view.settings.explicitUndefined).toBeUndefined();
    expect(view.createdAt).toBe(config.createdAt);
    expect(view.bytes).toBe(config.bytes);
    expect(view.lookup).toBe(config.lookup);
    expect(view.tags).toBe(config.tags);
    expect(view.compute).toBe(config.compute);
    expect(view.instance).toBe(config.instance);
  });

  it('non-plain values behave as themselves through the view (Date, Map, Set, class instance, typed array)', () => {
    const config = createSyntheticConfig();
    const { view } = createConfigRecorder(config);

    expect(view.createdAt.getTime()).toBe(0);
    expect(view.lookup.get('k')).toBe(1);
    expect(view.tags.has('t')).toBe(true);
    expect(view.bytes[1]).toBe(2);
    expect(view.instance).toBeInstanceOf(Counter);
    expect(view.instance.increment()).toBe(1);
    expect(view.compute(2)).toBe(4);
  });

  it('plain objects and arrays come back as child views, not the raw objects', () => {
    const config = createSyntheticConfig();
    const { view } = createConfigRecorder(config);

    expect(view.settings).not.toBe(config.settings);
    expect(view.members).not.toBe(config.members);
    expect(Array.isArray(view.members)).toBe(true);
    expect(typeof view.settings).toBe('object');
    expect(Object.getPrototypeOf(view.settings)).toBe(Object.getPrototypeOf(config.settings));
    expect(Object.getPrototypeOf(view.members)).toBe(Array.prototype);
  });

  it('reads of absent keys return undefined', () => {
    const config = createSyntheticConfig();
    const { view } = createConfigRecorder(config);
    expect(view.settings.optional).toBeUndefined();
    const dynamic: Record<string, unknown> = view.settings;
    expect(dynamic['missing']).toBeUndefined();
  });

  it('`instanceof`, `Array.isArray` and `typeof` checks a template might make hold on the view', () => {
    const config = createSyntheticConfig();
    const { view } = createConfigRecorder(config);
    expect(view.members instanceof Array).toBe(true);
    expect(view.settings instanceof Object).toBe(true);
    expect(typeof view.members).toBe('object');
  });
});

describe('INV-3 — serialisation through the view is byte-identical', () => {
  it('JSON.stringify(view) === JSON.stringify(config), compact and indented', () => {
    const config = createJsonConfig();
    const { view } = createConfigRecorder(config);
    expect(JSON.stringify(view)).toBe(JSON.stringify(config));
    expect(JSON.stringify(view, null, 2)).toBe(JSON.stringify(config, null, 2));
  });

  it('honours a replacer identically', () => {
    const config = createJsonConfig();
    const { view } = createConfigRecorder(config);
    const replacer = (k: string, v: unknown): unknown => (k === 'symbol' ? undefined : v);
    expect(JSON.stringify(view, replacer)).toBe(JSON.stringify(config, replacer));
  });

  it('stableJsonStringify and computeConfigHash agree between view and config', () => {
    const config = createJsonConfig();
    const { view } = createConfigRecorder(config);
    expect(stableJsonStringify(view)).toBe(stableJsonStringify(config));
    expect(computeConfigHash(view)).toBe(computeConfigHash(config));
  });

  it('Object.keys / entries / spread / for…in enumerate the same keys in the same order per node', () => {
    const config = createJsonConfig();
    const { view } = createConfigRecorder(config);

    expect(Object.keys(view)).toEqual(Object.keys(config));
    expect(Object.keys(view.settings)).toEqual(Object.keys(config.settings));
    expect(Object.entries(view.settings).map(([k]) => k)).toEqual(Object.keys(config.settings));
    expect(Object.keys({ ...view.settings })).toEqual(Object.keys(config.settings));
    const forIn: string[] = [];
    for (const k in view.settings) forIn.push(k);
    expect(forIn).toEqual(Object.keys(config.settings));
    expect(Object.keys(view.members)).toEqual(['0', '1']);
    expect(Object.keys(view.emptyList)).toEqual([]);
    expect(Object.keys(view.settings.emptyObject)).toEqual([]);
  });

  it('serialisation is identical on a deep-frozen copy of the same config', () => {
    const config = deepFreeze(createJsonConfig());
    const { view } = createConfigRecorder(config);
    expect(JSON.stringify(view, null, 2)).toBe(JSON.stringify(config, null, 2));
    expect(computeConfigHash(view)).toBe(computeConfigHash(config));
  });
});

describe('INV-4 — every string-key read on a plain object records parent.key, whatever the value', () => {
  it.each<[string, (v: ReturnType<typeof createSyntheticConfig>) => unknown, unknown]>([
    ['empty string', (v) => v.settings.emptyString, ''],
    ['false', (v) => v.settings.flagOff, false],
    ['zero', (v) => v.settings.zero, 0],
    ['null', (v) => v.settings.nothing, null],
    ['undefined-valued own key', (v) => v.settings.explicitUndefined, undefined],
    ['absent key', (v) => v.settings.optional, undefined],
  ])(
    'get of a %s value records exactly the path and returns the value by identity',
    (_label, read, expected) => {
      const config = createSyntheticConfig();
      const recorder = createConfigRecorder(config);
      const value = read(recorder.view);
      expect(value).toBe(expected);
      // INV-35: `settings` was only traversed on the way to the leaf, so only the leaf is reported.
      const drained = recorder.drain();
      expect(drained).toHaveLength(1);
      expect(drained[0]?.startsWith('settings.')).toBe(true);
    }
  );

  it('records NaN-valued keys like any other', () => {
    const config = { n: Number.NaN };
    const recorder = createConfigRecorder(config);
    expect(Number.isNaN(recorder.view.n)).toBe(true);
    expect(recorder.drain()).toEqual(['n']);
  });

  it('records a nested-object read and an array read as the path of the read, not their contents', () => {
    const config = createSyntheticConfig();
    const recorder = createConfigRecorder(config);
    void recorder.view.settings.nested;
    expect(recorder.drain()).toEqual(['settings.nested']);
    void recorder.view.members;
    expect(recorder.drain()).toEqual(['members']);
  });

  it("spec AS-1: '' / false / absent triple — recorded and returned with ===", () => {
    const config = { t: { a: '', b: false } } as { t: { a: string; b: boolean; c?: number } };
    const recorder = createConfigRecorder(config);
    expect(recorder.view.t.a).toBe('');
    expect(recorder.view.t.b).toBe(false);
    expect(recorder.view.t.c).toBe(undefined);
    expect(recorder.drain()).toEqual(['t.a', 't.b', 't.c']);
  });

  it("`'k' in view.token` records token.k", () => {
    const config = { token: { k: 1 } };
    const recorder = createConfigRecorder(config);
    void recorder.view.token;
    recorder.drain();
    expect('k' in recorder.view.token).toBe(true);
    expect('missing' in recorder.view.token).toBe(false);
    expect(recorder.drain()).toEqual(['token.k', 'token.missing']);
  });

  it('hasOwnProperty (getOwnPropertyDescriptor trap) records token.k', () => {
    const config = { token: { k: 1 } };
    const recorder = createConfigRecorder(config);
    const token = recorder.view.token;
    recorder.drain();
    expect(hasOwn(token, 'k')).toBe(true);
    expect(recorder.drain()).toEqual(['token.k']);
    expect(Object.getOwnPropertyDescriptor(token, 'k')?.value).toBe(1);
    expect(recorder.drain()).toEqual(['token.k']);
  });

  it('optional chaining stops recording at the first absent node', () => {
    interface Cfg {
      a: { b?: { c?: number } };
    }
    const config: Cfg = { a: {} };
    const recorder = createConfigRecorder(config);
    expect(recorder.view.a?.b?.c).toBeUndefined();
    expect(recorder.drain()).toEqual(['a.b']);
  });

  describe('noise classes record nothing', () => {
    const inherited = [
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      '__proto__',
      'isPrototypeOf',
    ];
    it.each(inherited)('inherited-not-own key %j on a plain object', (k) => {
      const config = { settings: { name: 'x' } };
      const recorder = createConfigRecorder(config);
      const settings: Record<string, unknown> = recorder.view.settings;
      recorder.drain();
      void settings[k];
      void (k in settings);
      expect(recorder.drain()).toEqual([]);
    });

    it.each(['toJSON', 'then'])('probe key %j', (k) => {
      const config = { settings: { name: 'x' } };
      const recorder = createConfigRecorder(config);
      const settings: Record<string, unknown> = recorder.view.settings;
      recorder.drain();
      expect(settings[k]).toBeUndefined();
      void (k in settings);
      void Object.getOwnPropertyDescriptor(settings, k);
      expect(recorder.drain()).toEqual([]);
    });

    it('a probe key that the config actually OWNS is still filtered (fixed set, not value-based)', () => {
      const config = { settings: { toJSON: 'own-value', then: 1 } };
      const recorder = createConfigRecorder(config);
      const settings: Record<string, unknown> = recorder.view.settings;
      recorder.drain();
      expect(settings['toJSON']).toBe('own-value');
      expect(recorder.drain()).toEqual([]);
    });

    it('symbol keys (Symbol.iterator, Symbol.toPrimitive, Symbol.isConcatSpreadable)', () => {
      const config = { settings: { name: 'x' }, list: [1, 2] };
      const recorder = createConfigRecorder(config);
      const settings: object = recorder.view.settings;
      const list: object = recorder.view.list;
      recorder.drain();
      void Reflect.get(settings, Symbol.toPrimitive);
      void Reflect.get(list, Symbol.iterator);
      void Reflect.get(list, Symbol.isConcatSpreadable);
      void Reflect.has(settings, Symbol.toStringTag);
      expect(recorder.drain()).toEqual([]);
    });

    it('await on a view probes `then` and records nothing', async () => {
      const config = { settings: { name: 'x' } };
      const recorder = createConfigRecorder(config);
      const settings = recorder.view.settings;
      recorder.drain();
      const same = await settings;
      expect(same).toBe(settings);
      expect(recorder.drain()).toEqual([]);
    });
  });
});

describe('INV-5 — array reads record p for iteration and p[i] for element access', () => {
  interface ArrCfg {
    arr: Array<{ id: string; address: string }>;
    empty: never[];
  }
  const make = (): ArrCfg => ({
    arr: [
      { id: 'a', address: 'A' },
      { id: 'b', address: 'B' },
    ],
    empty: [],
  });

  it('v.arr[1].address → [arr[1].address] (traversal steps pruned, INV-35)', () => {
    const r = createConfigRecorder(make());
    expect(r.view.arr[1]?.address).toBe('B');
    expect(r.drain()).toEqual(['arr[1].address']);
  });

  it('v.arr.length → [arr] only', () => {
    const r = createConfigRecorder(make());
    expect(r.view.arr.length).toBe(2);
    expect(r.drain()).toEqual(['arr']);
  });

  it('for…of over a 2-element array reading a leaf → arr plus each leaf, no bare [i]', () => {
    const r = createConfigRecorder(make());
    const seen: string[] = [];
    for (const x of r.view.arr) seen.push(x.id);
    expect(seen).toEqual(['a', 'b']);
    expect(r.drain()).toEqual(['arr', 'arr[0].id', 'arr[1].id']);
  });

  it('v.arr.map(x => x.id) → arr plus arr[i].id, no bare [i]', () => {
    const r = createConfigRecorder(make());
    expect(r.view.arr.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.drain()).toEqual(['arr', 'arr[0].id', 'arr[1].id']);
  });

  it('array methods that touch only some elements record only those (slice(1) → arr, arr[1])', () => {
    const r = createConfigRecorder(make());
    const tail = r.view.arr.slice(1);
    expect(tail).toHaveLength(1);
    expect(r.drain()).toEqual(['arr', 'arr[1]']);
  });

  it('.length on an empty array → [empty] and nothing else', () => {
    const r = createConfigRecorder(make());
    expect(r.view.empty.length).toBe(0);
    expect(r.drain()).toEqual(['empty']);
  });

  it.each([
    '01',
    '-1',
    ' 1',
    '1e3',
    '1.0',
    'map',
    'flatMap',
    'filter',
    'forEach',
    'join',
    'includes',
    'indexOf',
    'at',
    'constructor',
  ])('non-index string key %j on an array records the array path', (k) => {
    const r = createConfigRecorder(make());
    const arr: object = r.view.arr;
    r.drain();
    void Reflect.get(arr, k);
    expect(r.drain()).toEqual(['arr']);
  });

  it("`'map' in view.arr` records arr (has trap, non-index key)", () => {
    const r = createConfigRecorder(make());
    const arr: object = r.view.arr;
    r.drain();
    expect('map' in arr).toBe(true);
    expect(r.drain()).toEqual(['arr']);
  });

  it('[...v.arr] → arr plus every index', () => {
    const r = createConfigRecorder(make());
    const copy = [...r.view.arr];
    expect(copy).toHaveLength(2);
    expect(r.drain()).toEqual(['arr', 'arr[0]', 'arr[1]']);
  });

  it('a `has` on a sparse hole returns false and records the array path (INV-5 rev 2)', () => {
    const sparse: { arr: Array<number | undefined> } = { arr: [0, , 2] };
    const r = createConfigRecorder(sparse);
    const arr: object = r.view.arr;
    r.drain();
    expect(1 in arr).toBe(false);
    expect(r.drain()).toEqual(['arr']);
  });

  it('an out-of-range index records arr[i] (terminal) and returns undefined', () => {
    const r = createConfigRecorder(make());
    expect(r.view.arr[5]).toBeUndefined();
    expect(r.drain()).toEqual(['arr[5]']);
  });

  it('Reflect.ownKeys(view.arr) (ownKeys alone) records arr only', () => {
    const r = createConfigRecorder(make());
    const arr = r.view.arr;
    r.drain();
    expect(Reflect.ownKeys(arr)).toEqual(['0', '1', 'length']);
    expect(r.drain()).toEqual(['arr']);
  });

  it('Object.keys(view.arr) records arr plus arr[i] for each element whose descriptor it inspects', () => {
    const r = createConfigRecorder(make());
    const arr = r.view.arr;
    r.drain();
    expect(Object.keys(arr)).toEqual(['0', '1']);
    expect(r.drain()).toEqual(['arr', 'arr[0]', 'arr[1]']);
  });

  it('an array-rooted config records the root for any index read and returns the raw element', () => {
    const rootArray = [{ id: 'x' }, { id: 'y' }];
    const r = createConfigRecorder(rootArray);
    const first = r.view[0];
    expect(first).toBe(rootArray[0]);
    expect(r.view.length).toBe(2);
    expect(r.drain()).toEqual(['']);
  });

  it('spec AS-2 shape: trustedIssuers[1].address + ownership.type + variant member', () => {
    const cfg = {
      trustedIssuers: [{ address: 'A' }, { address: 'B' }],
      ownership: { type: 'single', ownerAddress: 'O' },
    };
    const r = createConfigRecorder(cfg);
    void r.view.trustedIssuers[1]?.address;
    if (r.view.ownership.type === 'single') void r.view.ownership.ownerAddress;
    // INV-35: `ownership`, `trustedIssuers`, `trustedIssuers[1]` were traversal steps only.
    expect(r.drain()).toEqual([
      'ownership.ownerAddress',
      'ownership.type',
      'trustedIssuers[1].address',
    ]);
  });
});

describe('INV-24 — recorded keys are exactly the config keys; unrepresentable keys fall back to the parent', () => {
  it('records camelCase keys verbatim (no normalisation)', () => {
    const cfg = { compliance: { modules: [{ config: { maxBalance: 1 } }] } };
    const r = createConfigRecorder(cfg);
    void r.view.compliance.modules[0]?.config.maxBalance;
    expect(r.drain()).toContain('compliance.modules[0].config.maxBalance');
    expect(r.drain()).not.toContain('compliance.modules[0].config.max_balance');
  });

  it.each(['weird.key', '', 'br[0]', 'close]'])(
    'key %j records the PARENT path, returns the raw value and does not throw',
    (k) => {
      const cfg: { parent: Record<string, unknown> } = { parent: { [k]: 'raw' } };
      const r = createConfigRecorder(cfg);
      const parent = r.view.parent;
      r.drain();
      expect(parent[k]).toBe('raw');
      expect(r.drain()).toEqual(['parent']);
      expect(k in parent).toBe(true);
      expect(r.drain()).toEqual(['parent']);
    }
  );

  it('an unrepresentable key holding an object is returned RAW (no descent → no lying child paths)', () => {
    const inner = { leaf: 1 };
    const cfg: { parent: Record<string, unknown> } = { parent: { 'a.b': inner } };
    const r = createConfigRecorder(cfg);
    expect(r.view.parent['a.b']).toBe(inner);
    expect(r.drain()).toEqual(['parent']);
  });

  it("unicode key '名前' is emitted verbatim", () => {
    const cfg = { parent: { 名前: 'n' } };
    const r = createConfigRecorder(cfg);
    expect(r.view.parent.名前).toBe('n');
    expect(r.drain()).toEqual(['parent.名前']);
  });

  it('every path the recorder emits round-trips through parse/format', () => {
    const config = createSyntheticConfig();
    const r = createConfigRecorder(config);
    JSON.stringify(r.view);
    void r.view.modules[0]?.config?.['weird.key'];
    void r.view.members.map((m) => m.weight);
    for (const path of r.all()) {
      expect(formatConfigPath(parseConfigPath(path)), path).toBe(path);
    }
  });
});

describe('INV-29 — discriminants and dynamic keys are ordinary dependencies', () => {
  it('switch on a union tag then read the variant member records both paths', () => {
    const cfg: { accessControl: { ownership: { type: 'single'; ownerAddress: string } } } = {
      accessControl: { ownership: { type: 'single', ownerAddress: 'O' } },
    };
    const r = createConfigRecorder(cfg);
    const o = r.view.accessControl.ownership;
    r.drain();
    switch (o.type) {
      case 'single':
        void o.ownerAddress;
    }
    expect(r.drain()).toEqual([
      'accessControl.ownership.ownerAddress',
      'accessControl.ownership.type',
    ]);
  });

  it("dynamic key on a Record: v.mods[0].config?.['maxBalance']", () => {
    const cfg: { mods: Array<{ config?: Record<string, unknown> }> } = {
      mods: [{ config: { maxBalance: 5 } }],
    };
    const r = createConfigRecorder(cfg);
    const mods = r.view.mods;
    r.drain();
    expect(mods[0]?.config?.['maxBalance']).toBe(5);
    expect(r.drain()).toEqual(['mods[0].config.maxBalance']);
  });
});

describe('INV-34 — getOwnPropertyDescriptor reports truthfully within Proxy invariants', () => {
  it('a present key on an object view: real value/enumerable, configurable forced true (unfrozen → writable true)', () => {
    const cfg = { token: { name: 'N' } };
    const { view } = createConfigRecorder(cfg);
    expect(Object.getOwnPropertyDescriptor(view.token, 'name')).toEqual({
      value: 'N',
      writable: true,
      enumerable: true,
      configurable: true,
    });
  });

  it('a present key on a FROZEN object view: writable reported as real (false), configurable forced true', () => {
    const cfg = deepFreeze({ token: { name: 'N' } });
    const { view } = createConfigRecorder(cfg);
    expect(Object.getOwnPropertyDescriptor(view.token, 'name')).toEqual({
      value: 'N',
      writable: false,
      enumerable: true,
      configurable: true,
    });
  });

  it('`length` on an array view: real value, non-enumerable, configurable false, writable true (amendment 7) — unfrozen and frozen', () => {
    for (const cfg of [{ arr: [1, 2] }, deepFreeze({ arr: [1, 2] })]) {
      const { view } = createConfigRecorder(cfg);
      expect(() => Object.getOwnPropertyDescriptor(view.arr, 'length')).not.toThrow();
      expect(Object.getOwnPropertyDescriptor(view.arr, 'length')).toEqual({
        value: 2,
        writable: true,
        enumerable: false,
        configurable: false,
      });
    }
  });

  it('an absent key returns undefined and records the path', () => {
    const cfg = { token: { name: 'N' } };
    const r = createConfigRecorder(cfg);
    const token = r.view.token;
    r.drain();
    expect(Object.getOwnPropertyDescriptor(token, 'missing')).toBeUndefined();
    expect(r.drain()).toEqual(['token.missing']);
  });

  it("Reflect.ownKeys(view.arr) includes 'length'", () => {
    const { view } = createConfigRecorder({ arr: [1] });
    expect(Reflect.ownKeys(view.arr)).toContain('length');
  });
});

describe('INV-26 — frozen and null-prototype inputs record identically and never trip a Proxy invariant', () => {
  function script(view: ReturnType<typeof createJsonConfig>): unknown[] {
    return [
      view.settings.name,
      view.settings.emptyString,
      view.settings.flagOff,
      view.settings.optional,
      view.members.length,
      view.members[1]?.address,
      view.members.map((m) => m.id).join(),
      [...view.members].length,
      Object.keys(view.members).join(),
      Object.keys({ ...view.members }).join(),
      Object.getOwnPropertyDescriptor(view.members, 'length')?.value,
      Object.entries(view.settings).length,
      JSON.stringify(view),
      Reflect.ownKeys(view.settings).length,
      view.emptyList.length,
      view.modules[0]?.config?.['weird.key'],
      view.ownership.type,
    ];
  }

  it('the full trap-table script yields identical values and identical paths on c and deepFreeze(c), with no throw', () => {
    const plain = createJsonConfig();
    const frozen = deepFreeze(structuredClone(createJsonConfig()));
    const a = createConfigRecorder(plain);
    const b = createConfigRecorder(frozen);
    let valuesA: unknown[] = [];
    let valuesB: unknown[] = [];
    expect(() => (valuesA = script(a.view))).not.toThrow();
    expect(() => (valuesB = script(b.view))).not.toThrow();
    expect(valuesA).toEqual(valuesB);
    expect(a.all()).toEqual(b.all());
    expect(a.all().length).toBeGreaterThan(10);
  });

  it("Object.keys(view.arr) on a frozen array → ['0','1']", () => {
    const { view } = createConfigRecorder(deepFreeze({ arr: ['x', 'y'] }));
    expect(Object.keys(view.arr)).toEqual(['0', '1']);
  });

  it('null-prototype objects are descended into and their view reports a null prototype', () => {
    const inner = Object.assign(Object.create(null) as Record<string, unknown>, { leaf: 'L' });
    const cfg = { np: inner };
    const r = createConfigRecorder(cfg);
    const np = r.view.np;
    expect(Object.getPrototypeOf(np)).toBeNull();
    expect(np['leaf']).toBe('L');
    expect(r.drain()).toEqual(['np.leaf']);
  });

  it('a frozen root config is wrapped (the view is not the config) and reads return real values', () => {
    const cfg = deepFreeze({ token: { name: 'N' } });
    const { view } = createConfigRecorder(cfg);
    expect(view).not.toBe(cfg);
    expect(view.token.name).toBe('N');
  });
});

describe('INV-27 — structuredClone of a view throws DataCloneError (documented host behaviour)', () => {
  it('root view', () => {
    const { view } = createConfigRecorder(createJsonConfig());
    let caught: unknown;
    try {
      structuredClone(view);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught instanceof Error && caught.name).toBe('DataCloneError');
  });

  it('child view', () => {
    const { view } = createConfigRecorder(createJsonConfig());
    expect(() => structuredClone(view.settings)).toThrowError(/could not be cloned/);
  });
});
