/**
 * SF-10 — what `addRange` refuses, and what it leaves behind when it refuses.
 * INV-9, INV-10, INV-11, INV-26 (core half).
 * Category: Error Semantics + Sensitive Data Handling.
 *
 * The unconditional-on-`enabled` cells are the ones worth reading twice: a
 * subset check that only runs when recording is on is a check that never runs
 * on the wizard's `recordProvenance: false` download path, which is the one
 * path a user is actually standing in front of.
 */
import { describe, expect, it } from 'vitest';

import { ProvenanceAttributionError, ProvenanceScopeError } from '../../src/provenance/errors';
import type { ProvenanceAttributionErrorReason } from '../../src/provenance/errors';
import { createProvenanceCollector } from '../../src/provenance/provenance-collector';
import type { ProvenanceScope } from '../../src/provenance/provenance-collector';
import type { ConfigPath, ProvenanceEntry } from '../../src/provenance/types';

interface Cfg {
  readonly token: { readonly name: string };
}
const CONFIG: Cfg = { token: { name: 'Alpha' } };
const FILE = 'out/deploy.sh';

/** Run `body` inside one recording scope and hand back the assembled entries. */
function withScope(
  enabled: boolean,
  body: (scope: ProvenanceScope<Cfg>) => void
): readonly ProvenanceEntry[] {
  const collector = createProvenanceCollector(CONFIG, { enabled });
  collector.record(FILE, body);
  return collector.result()?.files[FILE]?.entries ?? [];
}

const attributionError = (run: () => void): ProvenanceAttributionError => {
  try {
    run();
  } catch (error) {
    if (error instanceof ProvenanceAttributionError) return error;
    throw error;
  }
  throw new Error('expected a ProvenanceAttributionError');
};

describe('INV-9 — `secondary-not-attributed` throws iff the subset rule is violated', () => {
  it.each([true, false])('an unattributed path throws with enabled=%s', (enabled) => {
    const error = attributionError(() => {
      withScope(enabled, (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name'], {
          secondaryPaths: ['token.decimals'],
        });
      });
    });
    expect(error.reason).toBe<ProvenanceAttributionErrorReason>('secondary-not-attributed');
    expect(error.filePath).toBe(FILE);
  });

  it('a valid subset records with enabled=true', () => {
    const entries = withScope(true, (scope) => {
      scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['token.name'] });
    });
    expect(entries.filter((entry) => entry.kind === 'range')).toHaveLength(1);
  });

  it('a valid subset records nothing and does not throw with enabled=false', () => {
    const collector = createProvenanceCollector(CONFIG, { enabled: false });
    expect(() =>
      collector.record(FILE, (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['token.name'] });
      })
    ).not.toThrow();
    expect(collector.result()).toBeUndefined();
  });

  it('duplicates and ordering are irrelevant — the rule compares sets', () => {
    expect(() =>
      withScope(true, (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['b.y', 'a.x'], {
          secondaryPaths: ['a.x', 'a.x', 'b.y'],
        });
      })
    ).not.toThrow();
  });

  it('`offending` names only the paths that are NOT attributed, sorted', () => {
    const error = attributionError(() => {
      withScope(true, (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name'], {
          secondaryPaths: ['z.late', 'token.name', 'a.early'],
        });
      });
    });
    expect(error.paths).toEqual(['a.early', 'z.late']);
    // Never the full declared set — the attributed member is not an offence.
    expect(error.paths).not.toContain('token.name');
  });

  it('the scope and range guards report first — a closed scope beats a bad subset', () => {
    const collector = createProvenanceCollector(CONFIG, { enabled: true });
    let escaped: ProvenanceScope<Cfg> | undefined;
    collector.record(FILE, (scope) => {
      escaped = scope;
    });
    if (escaped === undefined) throw new Error('expected a scope');
    try {
      escaped.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['nope'] });
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ProvenanceScopeError);
      expect((error as ProvenanceScopeError).reason).toBe('closed');
    }
  });

  it('an invalid range beats a bad subset — RangeError, not the attribution error', () => {
    expect(() =>
      withScope(true, (scope) => {
        scope.addRange({ start: 0, end: 1 }, ['token.name'], { secondaryPaths: ['nope'] });
      })
    ).toThrow(RangeError);
  });
});

describe('INV-10 — one new reason on the existing error, no new class, no new shape', () => {
  it('the thrown instance is the existing class with the existing code', () => {
    const error = attributionError(() => {
      withScope(true, (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['token.other'] });
      });
    });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ProvenanceAttributionError);
    expect(error.name).toBe('ProvenanceAttributionError');
    expect(error.code).toBe('PROVENANCE_ATTRIBUTION');
    expect(Object.keys(error)).toEqual(
      expect.arrayContaining(['code', 'reason', 'filePath', 'paths'])
    );
  });

  it('its message is non-empty and names the file and the offending paths', () => {
    const error = new ProvenanceAttributionError('secondary-not-attributed', 'out/deploy.sh', [
      'token.decimals',
    ]);
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.message).toContain('out/deploy.sh');
    expect(error.message).toContain('token.decimals');
  });
});

describe('INV-11 — a rejected `addRange` is total', () => {
  it('nothing is recorded, and a later well-formed call on the same scope records normally', () => {
    const entries = withScope(true, (scope) => {
      try {
        scope.addRange({ start: 1, end: 1 }, ['token.rejected'], {
          secondaryPaths: ['token.absent'],
        });
      } catch {
        // expected — the point is what the scope looks like afterwards
      }
      scope.addRange({ start: 5, end: 6 }, ['token.name'], { secondaryPaths: ['token.name'] });
    });

    const ranges = entries.filter((entry) => entry.kind === 'range');
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.range).toEqual({ start: 5, end: 6 });

    // The rejected call's paths must not have reached the file entry: a
    // fabricated attribution introduced by an error path would give the user a
    // whole-file row for a field the file does not depend on.
    const fileEntry = entries.find((entry) => entry.kind === 'file');
    expect(fileEntry?.paths).toEqual(['token.name']);
    expect(fileEntry?.paths).not.toContain('token.rejected');
    expect(fileEntry?.paths).not.toContain('token.absent');
  });

  it('a throw escaping `produce` closes the scope and leaves the collector usable', () => {
    const collector = createProvenanceCollector(CONFIG, { enabled: true });
    collector.record('out/first.txt', (scope) => {
      scope.addRange({ start: 1, end: 1 }, ['token.name']);
    });
    expect(() =>
      collector.record('out/bad.txt', (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['nope'] });
      })
    ).toThrow(ProvenanceAttributionError);

    // Not `'nested'`: the failed scope was closed by the `finally`.
    expect(() =>
      collector.record('out/second.txt', (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name']);
      })
    ).not.toThrow();

    const result = collector.result();
    expect(Object.keys(result?.files ?? {})).toEqual(['out/first.txt', 'out/second.txt']);
  });
});

describe('INV-26 — the error carries structural identifiers only', () => {
  it('a config value reachable through the marked path never enters the message or members', () => {
    const sentinel = 'SENTINEL-9c21-token-name';
    const sensitive = { token: { name: sentinel } };
    const collector = createProvenanceCollector(sensitive, { enabled: true });

    const error = attributionError(() => {
      collector.record(FILE, (scope) => {
        // Read the value first, so the recorder has it in the drain window: the
        // error must still not be able to reach it.
        const seen: string = scope.config.token.name;
        expect(seen).toBe(sentinel);
        scope.addRange({ start: 1, end: 1 }, ['token.name'], {
          secondaryPaths: ['token.unattributed'],
        });
      });
    });

    expect(error.message).not.toContain(sentinel);
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(sentinel);
    expect(error.paths as readonly ConfigPath[]).toEqual(['token.unattributed']);
  });

  it('the constructor takes no parameter through which emitted text could arrive', () => {
    const error = new ProvenanceAttributionError('secondary-not-attributed', 'f.sh', ['a.b']);
    // Three members plus the code and the name; nothing that could hold a line
    // of output, and nothing added by this change.
    expect(new Set(Object.keys(error))).toEqual(
      new Set(['code', 'name', 'reason', 'filePath', 'paths'])
    );
  });
});
