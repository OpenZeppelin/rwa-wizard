/**
 * Recorder purity, cursor semantics and bounded allocation.
 * INV-12 (no shared state; per-recorder WeakMap), INV-13 (drain cursor vs all), INV-21 (cost).
 * Category: Idempotency & Retry + Resource Limits.
 */
import { describe, expect, it } from 'vitest';

import {
  CONFIG_RECORDER_PROBE_KEYS,
  createConfigRecorder,
} from '../../src/provenance/config-recorder';
import { PROVENANCE_ENTRY_KINDS, ROOT_CONFIG_PATH } from '../../src/provenance/types';
import { createJsonConfig, createSyntheticConfig, SyntheticGenerator } from './fixtures';

type Json = ReturnType<typeof createJsonConfig>;

function accessScript(view: Json): void {
  void view.settings.name;
  void view.members[1]?.address;
  void view.members.map((m) => m.id);
  JSON.stringify(view.modules);
  void view.settings.optional;
}

describe('INV-12 — recording is a pure function of (config, access sequence)', () => {
  it('two recorders over the same config object produce deep-equal drain()/all()', () => {
    const config = createJsonConfig();
    const a = createConfigRecorder(config);
    const b = createConfigRecorder(config);
    accessScript(a.view);
    accessScript(b.view);
    expect(a.drain()).toEqual(b.drain());
    expect(a.all()).toEqual(b.all());
  });

  it('two recorders over deep-equal (but distinct) configs produce deep-equal output', () => {
    const a = createConfigRecorder(createJsonConfig());
    const b = createConfigRecorder(createJsonConfig());
    accessScript(a.view);
    accessScript(b.view);
    expect(a.all()).toEqual(b.all());
  });

  it('interleaving two recorders does not cross-contaminate', () => {
    const config = createJsonConfig();
    const a = createConfigRecorder(config);
    const b = createConfigRecorder(config);
    void a.view.settings.name;
    void b.view.members.length;
    void a.view.settings.symbol;
    expect(a.drain()).toEqual(['settings.name', 'settings.symbol']);
    expect(b.drain()).toEqual(['members']);
  });

  it('a recorder created AFTER another one has recorded starts empty (no process-level history)', () => {
    const config = createJsonConfig();
    const first = createConfigRecorder(config);
    accessScript(first.view);
    const second = createConfigRecorder(config);
    expect(second.drain()).toEqual([]);
    expect(second.all()).toEqual([]);
  });

  it('module constants are frozen', () => {
    expect(Object.isFrozen(PROVENANCE_ENTRY_KINDS)).toBe(true);
    expect(Object.isFrozen(CONFIG_RECORDER_PROBE_KEYS)).toBe(true);
    expect(typeof ROOT_CONFIG_PATH).toBe('string');
    expect([...CONFIG_RECORDER_PROBE_KEYS].sort()).toEqual(['then', 'toJSON']);
    expect([...PROVENANCE_ENTRY_KINDS]).toEqual(['file', 'range', 'created']);
  });

  describe('memo-key rule: WeakMap<target, view> keyed on target identity', () => {
    it('(1) same target twice → the same view object', () => {
      const r = createConfigRecorder(createJsonConfig());
      expect(r.view.settings).toBe(r.view.settings);
      expect(r.view.members[0]).toBe(r.view.members[0]);
    });

    it('(2) two distinct deep-equal targets → distinct views', () => {
      const shared = { leaf: 1 };
      const cfg = { a: { leaf: 1 }, b: { leaf: 1 }, c: shared, d: shared };
      const r = createConfigRecorder(cfg);
      expect(r.view.a).not.toBe(r.view.b);
      // same target reached through two keys → same view (identity, not path)
      expect(r.view.c).toBe(r.view.d);
    });

    it('(3) a second recorder over the same config → a view !== the first recorder’s', () => {
      const config = createJsonConfig();
      const a = createConfigRecorder(config);
      const b = createConfigRecorder(config);
      expect(a.view).not.toBe(b.view);
      expect(a.view.settings).not.toBe(b.view.settings);
    });
  });
});

describe('INV-13 — drain() is a cursor; all() is not', () => {
  it('(1) read A, drain, read B, drain → [B]', () => {
    const r = createConfigRecorder({ A: 1, B: 2 });
    void r.view.A;
    expect(r.drain()).toEqual(['A']);
    void r.view.B;
    expect(r.drain()).toEqual(['B']);
  });

  it('(2) read A, drain, drain → []', () => {
    const r = createConfigRecorder({ A: 1 });
    void r.view.A;
    r.drain();
    expect(r.drain()).toEqual([]);
  });

  it('(3) read A twice → [A] once', () => {
    const r = createConfigRecorder({ A: 1 });
    void r.view.A;
    void r.view.A;
    expect(r.drain()).toEqual(['A']);
  });

  it('all() after drains equals the union of every drain so far and never resets', () => {
    const r = createConfigRecorder({ A: 1, B: 2, C: 3 });
    void r.view.B;
    const d1 = r.drain();
    void r.view.A;
    void r.view.C;
    const d2 = r.drain();
    expect(r.all()).toEqual([...d1, ...d2].sort());
    expect(r.all()).toEqual(['A', 'B', 'C']);
    expect(r.all()).toEqual(['A', 'B', 'C']);
  });

  it('returned arrays are fresh and mutating them does not affect the recorder', () => {
    const r = createConfigRecorder({ A: 1 });
    void r.view.A;
    const first = r.all();
    const second = r.all();
    expect(first).not.toBe(second);
    first.push('INJECTED');
    first.length = 0;
    expect(r.all()).toEqual(['A']);
    const drained = r.drain();
    drained.push('INJECTED');
    expect(r.drain()).toEqual([]);
  });

  it('drain() and all() are sorted by code-unit order and deduped', () => {
    const r = createConfigRecorder({ b: 1, a: 1, B: 1, a0: 1 });
    void r.view.b;
    void r.view.a;
    void r.view.B;
    void r.view.a0;
    void r.view.a;
    expect(r.drain()).toEqual(['B', 'a', 'a0', 'b']);
  });
});

describe('INV-21 — recording cost is linear in reads; allocation bounded by distinct nodes', () => {
  it('10 000 reads of view.token.name create one child view (identity stable) and one path', () => {
    const r = createConfigRecorder({ token: { name: 'n' } });
    const first = r.view.token;
    for (let i = 0; i < 10_000; i += 1) {
      expect(r.view.token).toBe(first);
      void r.view.token.name;
    }
    expect(r.all()).toEqual(['token.name']);
  });

  it('the synthetic generator under recording runs within a generous multiple of its un-recorded time (benchmark, wide bound)', () => {
    const generator = new SyntheticGenerator();
    const config = createSyntheticConfig();
    const rounds = 150;
    const time = (recordProvenance: boolean): number => {
      const start = performance.now();
      for (let i = 0; i < rounds; i += 1) generator.generate(config, { recordProvenance });
      return performance.now() - start;
    };
    for (let i = 0; i < 20; i += 1) {
      generator.generate(config, { recordProvenance: false });
      generator.generate(config, { recordProvenance: true });
    }
    // Alternate the two paths and keep the fastest of each: contention from the
    // rest of the suite running in parallel only ever ADDS time, so the minimum
    // is the least contaminated estimate of real cost. A single timed pair makes
    // the ratio a coin flip on a loaded machine, while a 10x regression still
    // fails every sample.
    let off = Number.POSITIVE_INFINITY;
    let on = Number.POSITIVE_INFINITY;
    for (let sample = 0; sample < 5; sample += 1) {
      off = Math.min(off, time(false));
      on = Math.min(on, time(true));
    }
    // Research measured 1.3–1.5×; the bound is deliberately loose so CI jitter never fails it,
    // while a per-access proxy allocation or per-access path formatting (10×+) still would.
    expect(on, `recorded ${on.toFixed(1)}ms vs plain ${off.toFixed(1)}ms`).toBeLessThan(
      Math.max(off * 6, 150)
    );
  });

  it('result output holds only strings and integers: JSON round-trip is lossless', () => {
    const generator = new SyntheticGenerator();
    const result = generator.generate(createSyntheticConfig(), { recordProvenance: true });
    expect(result.provenance).toBeDefined();
    expect(JSON.parse(JSON.stringify(result.provenance))).toEqual(result.provenance);
  });
});
