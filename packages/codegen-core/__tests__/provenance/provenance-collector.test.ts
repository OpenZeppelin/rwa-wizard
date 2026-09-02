/**
 * The collector: scopes, result shape, scope boundary, ordering, bypass.
 * INV-7, INV-10, INV-11, INV-14, INV-15, INV-16, INV-17, INV-18, INV-19, INV-20, INV-28.
 * Category: Request/Response + Error Semantics + Idempotency + Scope Boundary + Side-Effect Ordering.
 */
import { describe, expect, it } from 'vitest';

import { ProvenanceScopeError } from '../../src/provenance/errors';
import { createProvenanceCollector } from '../../src/provenance/provenance-collector';
import type {
  ProvenanceCollector,
  ProvenanceScope,
} from '../../src/provenance/provenance-collector';
import type { ProvenanceEntry, ProvenanceResult } from '../../src/provenance/types';

interface Cfg {
  token: { name: string; symbol: string; decimals: number };
  compliance: { modules: Array<{ moduleId: string }> };
  locked: { a: string; b: string };
  x: number;
  y: number;
  z: number;
}

const make = (): Cfg => ({
  token: { name: 'N', symbol: 'S', decimals: 7 },
  compliance: { modules: [{ moduleId: 'm0' }, { moduleId: 'm1' }] },
  locked: { a: 'A', b: 'B' },
  x: 1,
  y: 2,
  z: 3,
});

const enabled = (config: Cfg = make()): ProvenanceCollector<Cfg> =>
  createProvenanceCollector(config, { enabled: true });

function requireResult(collector: ProvenanceCollector<Cfg>): ProvenanceResult {
  const result = collector.result();
  if (result === undefined) throw new Error('expected an enabled collector to produce a result');
  return result;
}

function entriesOf(result: ProvenanceResult, file: string): readonly ProvenanceEntry[] {
  const fp = result.files[file];
  if (fp === undefined) throw new Error(`expected provenance for ${file}`);
  return fp.entries;
}

function captureScopeError(attempt: () => unknown): ProvenanceScopeError {
  try {
    attempt();
  } catch (error) {
    if (error instanceof ProvenanceScopeError) return error;
    throw new Error(`expected ProvenanceScopeError, got ${String(error)}`);
  }
  throw new Error('expected a ProvenanceScopeError to be thrown');
}

describe('INV-7 — canonical result shape', () => {
  it('interleaved reads b, a, b, c → paths sorted and deduped', () => {
    const c = enabled();
    c.record('f', ({ config }) => {
      void config.y;
      void config.x;
      void config.y;
      void config.z;
    });
    expect(entriesOf(requireResult(c), 'f')).toEqual([{ kind: 'file', paths: ['x', 'y', 'z'] }]);
  });

  it('entry order is file, created?, then ranges ascending by start (ties by end, then insertion)', () => {
    const c = enabled();
    c.record(
      'f',
      ({ config, addRange }) => {
        void config.x;
        addRange({ start: 10, end: 12 }, ['x']);
        addRange({ start: 3, end: 9 }, ['y']);
        addRange({ start: 3, end: 4 }, ['z']);
        addRange({ start: 3, end: 4 }, ['x']);
      },
      { createdBy: ['token.name'] }
    );
    expect(entriesOf(requireResult(c), 'f')).toEqual([
      { kind: 'file', paths: ['x', 'y', 'z'] },
      { kind: 'created', paths: ['token.name'] },
      { kind: 'range', range: { start: 3, end: 4 }, paths: ['z'] },
      { kind: 'range', range: { start: 3, end: 4 }, paths: ['x'] },
      { kind: 'range', range: { start: 3, end: 9 }, paths: ['y'] },
      { kind: 'range', range: { start: 10, end: 12 }, paths: ['x'] },
    ]);
  });

  it('files iterate in first-recorded order; re-recording keeps the original position', () => {
    const c = enabled();
    c.record('A', () => undefined);
    c.record('B', () => undefined);
    c.record('A', () => undefined);
    expect(Object.keys(requireResult(c).files)).toEqual(['A', 'B']);
  });

  it("SF-2's shape: drain() inside the scope does not remove paths from the file entry", () => {
    const c = enabled();
    const drains: string[][] = [];
    c.record('f', ({ config, drain }) => {
      void config.x;
      drains.push(drain());
      void config.y;
      drains.push(drain());
    });
    expect(drains).toEqual([['x'], ['y']]);
    expect(entriesOf(requireResult(c), 'f')[0]).toEqual({ kind: 'file', paths: ['x', 'y'] });
  });

  it('addRange paths fold into the file entry even when never read through the view (∪ range.paths ⊆ file.paths)', () => {
    const c = enabled();
    c.record('f', ({ config, addRange }) => {
      void config.x;
      addRange({ start: 1, end: 1 }, ['z']);
    });
    const [file] = entriesOf(requireResult(c), 'f');
    expect(file).toEqual({ kind: 'file', paths: ['x', 'z'] });
  });

  it('createdBy paths stay disjoint from the file entry', () => {
    const c = enabled();
    c.record(
      'f',
      ({ config }) => {
        void config.x;
      },
      { createdBy: ['m'] }
    );
    expect(entriesOf(requireResult(c), 'f')).toEqual([
      { kind: 'file', paths: ['x'] },
      { kind: 'created', paths: ['m'] },
    ]);
  });

  it('a scope that reads nothing yields a file entry with empty paths', () => {
    const c = enabled();
    c.record('f', () => 'static');
    expect(entriesOf(requireResult(c), 'f')).toEqual([{ kind: 'file', paths: [] }]);
  });
});

describe('INV-10 — typed errors; template errors propagate as the same object', () => {
  it('an Error thrown from produce propagates === the sentinel, unwrapped', () => {
    const c = enabled();
    const sentinel = new Error('Missing marker in template');
    let caught: unknown;
    try {
      c.record('f', () => {
        throw sentinel;
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(sentinel);
    expect(sentinel.message).toBe('Missing marker in template');
  });

  it('a non-Error throwable (string) from produce propagates unchanged too', () => {
    const c = enabled();
    expect(() =>
      c.record('f', () => {
        throw 'plain-string';
      })
    ).toThrow('plain-string');
  });

  it('an Error thrown from compute in observe propagates === the sentinel', () => {
    const c = enabled();
    const sentinel = new TypeError('compute failed');
    let caught: unknown;
    try {
      c.observe(() => {
        throw sentinel;
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(sentinel);
  });

  it.each([
    [{ start: 0, end: 1 }],
    [{ start: 2, end: 1 }],
    [{ start: 1.5, end: 2 }],
    [{ start: 1, end: 2.5 }],
    [{ start: Number.NaN, end: 1 }],
    [{ start: 1, end: Number.POSITIVE_INFINITY }],
    [{ start: -1, end: 0 }],
  ])('addRange(%j) throws RangeError', (range) => {
    const c = enabled();
    expect(() =>
      c.record('f', ({ addRange }) => {
        addRange(range, []);
      })
    ).toThrowError(RangeError);
  });

  it('addRange({start:1,end:1}) — a single line — is valid', () => {
    const c = enabled();
    expect(() =>
      c.record('f', ({ addRange }) => {
        addRange({ start: 1, end: 1 }, ['x']);
      })
    ).not.toThrow();
  });

  it.each(['a..b', '.a', 'a.', '[0]', 'a[01]', 'a[-1]'] as const)(
    'addRange rejects malformed path %j at write time',
    (path) => {
      const c = enabled();
      expect(() =>
        c.record('f', ({ addRange }) => {
          addRange({ start: 1, end: 1 }, [path]);
        })
      ).toThrowError(RangeError);
    }
  );

  it('addRange rejects a malformed secondaryPaths literal at write time', () => {
    const c = enabled();
    expect(() =>
      c.record('f', ({ addRange }) => {
        addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['a..b'] });
      })
    ).toThrowError(RangeError);
  });

  it('disabled addRange still validates path literals', () => {
    const c = createProvenanceCollector(make());
    expect(() =>
      c.record('f', ({ addRange }) => {
        addRange({ start: 1, end: 1 }, ['a..b']);
      })
    ).toThrowError(RangeError);
  });

  it('addRange rejects a non-string path element at write time', () => {
    const c = enabled();
    expect(() =>
      c.record('f', ({ addRange }) => {
        addRange({ start: 1, end: 1 }, [1 as unknown as string]);
      })
    ).toThrowError(RangeError);
  });

  it('ROOT path and ordinary dotted paths are accepted', () => {
    const c = enabled();
    expect(() =>
      c.record('f', ({ addRange }) => {
        addRange({ start: 1, end: 1 }, ['', 'token.name', 'members[0].address']);
      })
    ).not.toThrow();
  });

  it('ProvenanceScopeError carries name, code, reason, filePath, stack', () => {
    const error = new ProvenanceScopeError('nested', 'f.txt');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ProvenanceScopeError');
    expect(error.code).toBe('PROVENANCE_SCOPE');
    expect(error.reason).toBe('nested');
    expect(error.filePath).toBe('f.txt');
    expect(error.message).toContain('f.txt');
    expect(typeof error.stack).toBe('string');
    expect(new ProvenanceScopeError('closed').filePath).toBeUndefined();
  });
});

describe('INV-11 — a missing recording is a missing key; nothing is filled in', () => {
  it('a collector with one recorded file yields exactly one key even though the generator emitted more', () => {
    const c = enabled();
    c.createFile('recorded.txt', ({ config }) => `n=${config.token.name}`);
    // second file is emitted without a scope (not through the collector)
    const result = requireResult(c);
    expect(Object.keys(result.files)).toEqual(['recorded.txt']);
  });
});

describe('INV-14 — result() is idempotent and closes the collector', () => {
  it('(1) two calls return deep-equal (here: identical) results', () => {
    const c = enabled();
    c.record('f', ({ config }) => void config.x);
    const first = c.result();
    const second = c.result();
    expect(second).toEqual(first);
    expect(second).toBe(first);
  });

  it('(2) record after result throws closed with filePath set', () => {
    const c = enabled();
    c.result();
    const error = captureScopeError(() => c.record('late.txt', () => undefined));
    expect(error.reason).toBe('closed');
    expect(error.filePath).toBe('late.txt');
    expect(error.code).toBe('PROVENANCE_SCOPE');
  });

  it('(2b) createFile after result throws closed with filePath set', () => {
    const c = enabled();
    c.result();
    const error = captureScopeError(() => c.createFile('late.txt', () => ''));
    expect(error.reason).toBe('closed');
    expect(error.filePath).toBe('late.txt');
  });

  it('(3) observe after result throws closed with filePath undefined', () => {
    const c = enabled();
    c.result();
    const error = captureScopeError(() => c.observe((config) => config.x));
    expect(error.reason).toBe('closed');
    expect(error.filePath).toBeUndefined();
  });

  it('(4) a DISABLED collector also closes on result(): record/observe throw closed rather than no-op', () => {
    const c = createProvenanceCollector(make());
    expect(c.result()).toBeUndefined();
    expect(captureScopeError(() => c.record('f', () => undefined)).reason).toBe('closed');
    expect(captureScopeError(() => c.observe((config) => config.x)).reason).toBe('closed');
    expect(captureScopeError(() => c.createFile('f', () => '')).reason).toBe('closed');
  });

  it('the produce callback is NOT invoked when the collector is closed', () => {
    const c = enabled();
    c.result();
    let invoked = 0;
    expect(() =>
      c.record('f', () => {
        invoked += 1;
      })
    ).toThrowError(ProvenanceScopeError);
    expect(invoked).toBe(0);
  });

  it('many record/observe calls in any order before result() are allowed', () => {
    const c = enabled();
    for (let i = 0; i < 200; i += 1) {
      c.record(`f${i % 7}`, ({ config }) => void config.x);
      c.observe((config) => config.y);
    }
    expect(Object.keys(requireResult(c).files)).toHaveLength(7);
  });
});

describe('INV-15 — a file’s provenance contains only paths read through THAT file’s scope view', () => {
  it('raw reads, other scopes, observe, and post-close reads never attribute to a file', () => {
    const config = make();
    const c = enabled(config);

    // (1) raw read before recording — validation-style
    void config.locked.a;

    let leakedScope: ProvenanceScope<Cfg> | undefined;
    // (2) file X reads token.name; (3) raw captured config read inside the scope
    c.record('X', (scope) => {
      leakedScope = scope;
      void scope.config.token.name;
      void config.locked.b; // raw, not through the view
    });

    // (4) observe reads compliance.modules
    const observed = c.observe((cfg) => cfg.compliance.modules);
    expect(observed.paths).toEqual(['compliance.modules']);

    // post-close read through X's leaked view must throw (INV-17) and thus attribute nothing
    expect(() => leakedScope?.config.token.decimals).toThrowError(ProvenanceScopeError);

    // (5) file Y reads token.symbol
    c.record('Y', ({ config: cfg }) => void cfg.token.symbol);

    const result = requireResult(c);
    expect(entriesOf(result, 'X')).toEqual([{ kind: 'file', paths: ['token.name'] }]);
    expect(entriesOf(result, 'Y')).toEqual([{ kind: 'file', paths: ['token.symbol'] }]);
    const everything = JSON.stringify(result);
    expect(everything).not.toContain('locked');
    expect(everything).not.toContain('compliance');
    expect(everything).not.toContain('decimals');
  });

  it('observe inside a record scope attributes to no file and returns its own paths', () => {
    const c = enabled();
    let inner: readonly string[] = [];
    c.record('X', ({ config }) => {
      void config.x;
      inner = c.observe((cfg) => cfg.compliance.modules.length).paths;
    });
    expect(inner).toEqual(['compliance.modules']);
    expect(entriesOf(requireResult(c), 'X')).toEqual([{ kind: 'file', paths: ['x'] }]);
  });

  it('scope.config is a fresh view per scope: two scopes over the same config get different views', () => {
    const c = enabled();
    let a: Cfg | undefined;
    let b: Cfg | undefined;
    c.record('A', ({ config }) => {
      a = config;
    });
    c.record('B', ({ config }) => {
      b = config;
    });
    expect(a === undefined).toBe(false);
    expect(Object.is(a, b)).toBe(false);
  });
});

describe('INV-16 — scopes do not nest and are synchronous', () => {
  it('nested record throws nested with the INNER file path before running the inner produce; the outer completes normally', () => {
    const c = enabled();
    let innerRan = false;
    let caught: ProvenanceScopeError | undefined;
    c.record('outer.txt', ({ config }) => {
      void config.x;
      caught = captureScopeError(() =>
        c.record('inner.txt', () => {
          innerRan = true;
        })
      );
      void config.y;
    });
    expect(caught?.reason).toBe('nested');
    expect(caught?.filePath).toBe('inner.txt');
    expect(innerRan).toBe(false);
    const result = requireResult(c);
    expect(Object.keys(result.files)).toEqual(['outer.txt']);
    expect(entriesOf(result, 'outer.txt')).toEqual([{ kind: 'file', paths: ['x', 'y'] }]);
  });

  it('nested createFile throws nested as well', () => {
    const c = enabled();
    c.record('outer', () => {
      expect(captureScopeError(() => c.createFile('inner', () => '')).reason).toBe('nested');
    });
  });

  it('a DISABLED collector throws nested identically (independent of enabled)', () => {
    const c = createProvenanceCollector(make());
    c.record('outer', () => {
      const error = captureScopeError(() => c.record('inner', () => undefined));
      expect(error.reason).toBe('nested');
      expect(error.filePath).toBe('inner');
    });
  });

  it('a Promise-returning produce passes through; a read awaited inside it throws closed (binding test, Open Q2 not adopted)', async () => {
    const c = enabled();
    const pending = c.record('async.txt', async ({ config }) => {
      await Promise.resolve();
      return config.token.name;
    });
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).rejects.toBeInstanceOf(ProvenanceScopeError);
    await expect(pending).rejects.toMatchObject({ reason: 'closed', filePath: 'async.txt' });
    // and the outer collector is still usable
    c.record('next.txt', ({ config }) => void config.x);
    expect(Object.keys(requireResult(c).files)).toEqual(['async.txt', 'next.txt']);
  });
});

describe('INV-17 — no view escapes its scope', () => {
  it('reading the captured root view after the scope closed throws closed with the file path', () => {
    const c = enabled();
    let leaked: Cfg | undefined;
    c.record('f.txt', ({ config }) => {
      leaked = config;
    });
    const error = captureScopeError(() => leaked?.token);
    expect(error.reason).toBe('closed');
    expect(error.filePath).toBe('f.txt');
  });

  it('reading a captured CHILD view after close throws; has/ownKeys/getOwnPropertyDescriptor throw too', () => {
    const c = enabled();
    let child: Cfg['token'] | undefined;
    c.record('f.txt', ({ config }) => {
      child = config.token;
    });
    if (child === undefined) throw new Error('child not captured');
    const view = child;
    expect(() => view.name).toThrowError(ProvenanceScopeError);
    expect(() => 'name' in view).toThrowError(ProvenanceScopeError);
    expect(() => Object.keys(view)).toThrowError(ProvenanceScopeError);
    expect(() => Object.getOwnPropertyDescriptor(view, 'name')).toThrowError(ProvenanceScopeError);
    expect(() => JSON.stringify(view)).toThrowError(ProvenanceScopeError);
  });

  it('a view captured from a scope whose produce THREW is closed as well', () => {
    const c = enabled();
    let leaked: Cfg | undefined;
    expect(() =>
      c.record('f.txt', ({ config }) => {
        leaked = config;
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(captureScopeError(() => leaked?.x).reason).toBe('closed');
  });

  it('observe(c => c.compliance.modules) returns the RAW array by identity and its paths', () => {
    const config = make();
    const c = enabled(config);
    const observed = c.observe((cfg) => cfg.compliance.modules);
    expect(observed.value).toBe(config.compliance.modules);
    expect(observed.paths).toEqual(['compliance.modules']);
  });

  it('observe(c => c.token.name) returns the primitive', () => {
    const c = enabled();
    expect(c.observe((cfg) => cfg.token.name)).toEqual({
      value: 'N',
      paths: ['token.name'],
    });
  });

  it('observe returning a non-view object returns it as-is', () => {
    const c = enabled();
    const fresh = { computed: true };
    expect(c.observe(() => fresh).value).toBe(fresh);
  });

  it("record('x', s => s.config) returns the raw config object", () => {
    const config = make();
    const c = enabled(config);
    expect(c.record('x', (scope) => scope.config)).toBe(config);
    expect(c.record('y', (scope) => scope.config.token)).toBe(config.token);
  });

  it('observe’s view is closed after compute returns (a leaked observe view throws)', () => {
    const c = enabled();
    let leaked: Cfg | undefined;
    c.observe((cfg) => {
      leaked = cfg;
      return 0;
    });
    const error = captureScopeError(() => leaked?.x);
    expect(error.reason).toBe('closed');
    expect(error.filePath).toBeUndefined();
  });

  it('views nested inside a returned array are unwrapped: the same code works with recording on and off', () => {
    const config = make();
    const c = enabled(config);
    const observed = c.observe((cfg) => cfg.compliance.modules.filter(() => true));
    expect(observed.value).toHaveLength(2);
    expect(() => observed.value[0]?.moduleId).not.toThrow();
    expect(observed.value[0]).toBe(config.compliance.modules[0]);
    expect(observed.value).toEqual(config.compliance.modules);
    expect(observed.paths).toEqual([
      'compliance.modules',
      'compliance.modules[0]',
      'compliance.modules[1]',
    ]);
  });

  it('views nested inside a returned plain object are unwrapped; untouched containers keep identity', () => {
    const config = make();
    const c = enabled(config);
    const plain = { untouched: true };
    const observed = c.observe((cfg) => ({
      wrapped: cfg.token,
      plain,
      list: [cfg.compliance.modules[1]],
    }));
    expect(observed.value.wrapped).toBe(config.token);
    expect(observed.value.list[0]).toBe(config.compliance.modules[1]);
    expect(observed.value.plain).toBe(plain);
    expect(() => observed.value.wrapped.name).not.toThrow();
  });

  it('record() unwraps views nested in what produce returns, too', () => {
    const config = make();
    const c = enabled(config);
    const produced = c.record('f.txt', (scope) => [scope.config.token]);
    expect(produced[0]).toBe(config.token);
  });

  it('a view stashed in a non-plain container stays a closed view (documented boundary)', () => {
    const c = enabled();
    const observed = c.observe((cfg) => new Map([['token', cfg.token]]));
    expect(() => observed.value.get('token')?.name).toThrowError(ProvenanceScopeError);
  });

  it('scope.drain() and scope.addRange() after the scope closed throw closed (Code-stage tightening, Open Q2)', () => {
    const c = enabled();
    let leaked: ProvenanceScope<Cfg> | undefined;
    c.record('f.txt', (scope) => {
      leaked = scope;
    });
    expect(captureScopeError(() => leaked?.drain()).filePath).toBe('f.txt');
    expect(captureScopeError(() => leaked?.addRange({ start: 1, end: 1 }, ['x'])).reason).toBe(
      'closed'
    );
    // the late addRange installed nothing
    expect(entriesOf(requireResult(c), 'f.txt')).toEqual([{ kind: 'file', paths: [] }]);
  });
});

describe('INV-18 — re-recording replaces wholesale and keeps position', () => {
  it('README re-recorded with no ranges/createdBy → entries exactly [file] with the new paths; key order unchanged', () => {
    const c = enabled();
    c.record('A', () => undefined);
    c.record(
      'README.md',
      ({ config, addRange }) => {
        void config.x;
        addRange({ start: 1, end: 1 }, ['x']);
        addRange({ start: 2, end: 2 }, ['y']);
      },
      { createdBy: ['z'] }
    );
    c.record('B', () => undefined);
    c.record('README.md', ({ config }) => void config.token.symbol);
    const result = requireResult(c);
    expect(Object.keys(result.files)).toEqual(['A', 'README.md', 'B']);
    expect(entriesOf(result, 'README.md')).toEqual([{ kind: 'file', paths: ['token.symbol'] }]);
  });
});

describe('INV-19 — a throwing produce leaves the collector exactly as it was', () => {
  it('a first-time produce that throws installs nothing', () => {
    const c = enabled();
    expect(() =>
      c.record('f', ({ config }) => {
        void config.x;
        throw new Error('abort');
      })
    ).toThrow('abort');
    expect(requireResult(c).files).toEqual({});
  });

  it('re-recording with a throwing produce keeps the earlier entries', () => {
    const c = enabled();
    c.record('A', ({ config }) => void config.x);
    expect(() =>
      c.record('A', ({ config }) => {
        void config.y;
        throw new Error('abort');
      })
    ).toThrow('abort');
    expect(entriesOf(requireResult(c), 'A')).toEqual([{ kind: 'file', paths: ['x'] }]);
  });

  it('after the throw a subsequent record succeeds (no spurious nested)', () => {
    const c = enabled();
    expect(() =>
      c.record('A', () => {
        throw new Error('abort');
      })
    ).toThrow('abort');
    expect(() => c.record('B', ({ config }) => void config.x)).not.toThrow();
    expect(Object.keys(requireResult(c).files)).toEqual(['B']);
  });

  it('a throwing compute in observe leaves nothing behind and the collector stays usable', () => {
    const c = enabled();
    expect(() =>
      c.observe(() => {
        throw new Error('abort');
      })
    ).toThrow('abort');
    c.record('B', ({ config }) => void config.x);
    expect(Object.keys(requireResult(c).files)).toEqual(['B']);
  });
});

describe('INV-20 — enabled: false is a complete bypass with identical control flow', () => {
  it('(1) false: result undefined, drain [], observe paths [], scope.config === config, produce invoked once', () => {
    const config = make();
    const c = createProvenanceCollector(config, { enabled: false });
    expect(c.enabled).toBe(false);
    let invoked = 0;
    let seen: Cfg | undefined;
    let drained: string[] | undefined;
    const returned = c.record('f', (scope) => {
      invoked += 1;
      seen = scope.config;
      void scope.config.x;
      drained = scope.drain();
      scope.addRange({ start: 1, end: 2 }, ['x']);
      return 'value';
    });
    expect(returned).toBe('value');
    expect(invoked).toBe(1);
    expect(seen).toBe(config);
    expect(drained).toEqual([]);
    const observed = c.observe((cfg) => {
      expect(cfg).toBe(config);
      return cfg.token.name;
    });
    expect(observed).toEqual({ value: 'N', paths: [] });
    expect(c.result()).toBeUndefined();
  });

  it('(2) true: each returns recorded data and scope.config !== config', () => {
    const config = make();
    const c = createProvenanceCollector(config, { enabled: true });
    expect(c.enabled).toBe(true);
    let seen: Cfg | undefined;
    let drained: string[] | undefined;
    c.record('f', (scope) => {
      seen = scope.config;
      void scope.config.x;
      drained = scope.drain();
    });
    expect(Object.is(seen, config)).toBe(false);
    expect(drained).toEqual(['x']);
    expect(c.observe((cfg) => cfg.token.name).paths).toEqual(['token.name']);
    expect(c.result()).toBeDefined();
  });

  it('(3) enabled: undefined and no options object → disabled', () => {
    expect(createProvenanceCollector(make(), { enabled: undefined }).enabled).toBe(false);
    expect(createProvenanceCollector(make(), {}).enabled).toBe(false);
    expect(createProvenanceCollector(make()).enabled).toBe(false);
    expect(createProvenanceCollector(make()).result()).toBeUndefined();
  });

  it('(4) disabled addRange still validates the range shape', () => {
    const c = createProvenanceCollector(make());
    expect(() =>
      c.record('f', ({ addRange }) => {
        addRange({ start: 0, end: 0 }, []);
      })
    ).toThrowError(RangeError);
  });

  it('disabled createFile returns the same FileTree shape as enabled', () => {
    const off = createProvenanceCollector(make()).createFile(
      'a.txt',
      ({ config }) => `x=${config.x}`
    );
    const on = enabled().createFile('a.txt', ({ config }) => `x=${config.x}`);
    expect(off).toEqual({ 'a.txt': 'x=1' });
    expect(on).toEqual(off);
  });

  it('disabled: reading the raw config through scope.config after the scope closed does NOT throw (it is the raw object)', () => {
    const config = make();
    const c = createProvenanceCollector(config);
    let leaked: Cfg | undefined;
    c.record('f', (scope) => {
      leaked = scope.config;
    });
    expect(leaked?.x).toBe(1);
  });
});

describe('INV-28 — Observed and RecordOptions.createdBy are normalised at the boundary', () => {
  it("createdBy ['b','a','b'] → created.paths ['a','b']; caller array not retained", () => {
    const c = enabled();
    const createdBy = ['b', 'a', 'b'];
    c.record('f', () => undefined, { createdBy });
    createdBy.push('zzz');
    createdBy[0] = 'mutated';
    expect(entriesOf(requireResult(c), 'f')[1]).toEqual({ kind: 'created', paths: ['a', 'b'] });
  });

  it("addRange paths ['b','a','b'] → ['a','b']; caller array not retained", () => {
    const c = enabled();
    const paths = ['b', 'a', 'b'];
    c.record('f', ({ addRange }) => {
      addRange({ start: 1, end: 1 }, paths);
      paths.push('zzz');
    });
    const entries = entriesOf(requireResult(c), 'f');
    expect(entries[1]).toEqual({ kind: 'range', range: { start: 1, end: 1 }, paths: ['a', 'b'] });
    expect(entries[0]).toEqual({ kind: 'file', paths: ['a', 'b'] });
  });

  it('observe().paths is sorted, deduped and fresh', () => {
    const c = enabled();
    const first = c.observe((cfg) => {
      void cfg.y;
      void cfg.x;
      void cfg.y;
      return 0;
    });
    expect(first.paths).toEqual(['x', 'y']);
    const second = c.observe((cfg) => cfg.x);
    expect(second.paths).not.toBe(first.paths);
  });

  it('createdBy: [] → created entry with empty paths; omitted → no created entry', () => {
    const c = enabled();
    c.record('with', () => undefined, { createdBy: [] });
    c.record('without', () => undefined);
    c.record('undef', () => undefined, { createdBy: undefined });
    const result = requireResult(c);
    expect(entriesOf(result, 'with')).toEqual([
      { kind: 'file', paths: [] },
      { kind: 'created', paths: [] },
    ]);
    expect(entriesOf(result, 'without')).toEqual([{ kind: 'file', paths: [] }]);
    expect(entriesOf(result, 'undef')).toEqual([{ kind: 'file', paths: [] }]);
  });

  it('identical addRange twice → two range entries (core does not dedupe ranges)', () => {
    const c = enabled();
    c.record('f', ({ addRange }) => {
      addRange({ start: 2, end: 3 }, ['x']);
      addRange({ start: 2, end: 3 }, ['x']);
    });
    const ranges = entriesOf(requireResult(c), 'f').filter((e) => e.kind === 'range');
    expect(ranges).toHaveLength(2);
  });

  it('the range object passed to addRange is copied, not retained', () => {
    const c = enabled();
    const range = { start: 2, end: 3 };
    c.record('f', ({ addRange }) => {
      addRange(range, ['x']);
      range.start = 99;
    });
    const [, entry] = entriesOf(requireResult(c), 'f');
    expect(entry).toEqual({ kind: 'range', range: { start: 2, end: 3 }, paths: ['x'] });
  });
});
