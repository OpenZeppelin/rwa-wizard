/**
 * INV-8 (observe order), INV-11 (construction drain guard), INV-18/INV-20 (one builder per scope).
 * Categories: Request/Response, Error Semantics, Idempotency, Auth Boundary.
 */
import { describe, expect, it } from 'vitest';

import { bindScope } from '../../src/provenance/builder-registry';
import { ProvenanceAttributionError } from '../../src/provenance/errors';
import { createSpyScope } from './builder-fixtures';

describe('INV-11 — construction drain guard, one test per input', () => {
  it('(1) a read before binding throws reads-before-builder naming the paths and the file', () => {
    const scope = createSpyScope({ filePath: 'out/a.txt' });
    scope.read('settings.name');
    let caught: unknown;
    try {
      bindScope(scope);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ProvenanceAttributionError);
    const err = caught as ProvenanceAttributionError;
    expect(err.reason).toBe('reads-before-builder');
    expect(err.code).toBe('PROVENANCE_ATTRIBUTION');
    expect(err.filePath).toBe('out/a.txt');
    expect(err.paths).toEqual(['settings.name']);
    expect(err.message).toContain('out/a.txt');
    expect(err.message).toContain('settings.name');
    expect(err.name).toBe('ProvenanceAttributionError');
  });

  it('(2) nothing read → binds', () => {
    expect(() => bindScope(createSpyScope())).not.toThrow();
  });

  it('(3) disabled scope: a read is invisible, so it binds', () => {
    const scope = createSpyScope({ disabled: true });
    scope.read('settings.name');
    expect(() => bindScope(scope)).not.toThrow();
  });

  it('(4) a failed construction leaves no claim: binding again on the same scope succeeds', () => {
    const scope = createSpyScope();
    scope.read('settings.name');
    expect(() => bindScope(scope)).toThrow(ProvenanceAttributionError);
    expect(() => bindScope(scope)).not.toThrow();
  });
});

describe('INV-20 — exactly one builder per scope', () => {
  it('(1) the same scope twice → builder-exists with filePath', () => {
    const scope = createSpyScope({ filePath: 'out/b.txt' });
    bindScope(scope);
    let caught: unknown;
    try {
      bindScope(scope);
    } catch (error) {
      caught = error;
    }
    const err = caught as ProvenanceAttributionError;
    expect(err).toBeInstanceOf(ProvenanceAttributionError);
    expect(err.reason).toBe('builder-exists');
    expect(err.filePath).toBe('out/b.txt');
    expect(err.paths).toEqual([]);
  });

  it('(2) two distinct scopes are independent', () => {
    bindScope(createSpyScope());
    expect(() => bindScope(createSpyScope())).not.toThrow();
  });

  it('(5) a disabled scope is claimed like an enabled one', () => {
    const scope = createSpyScope({ disabled: true });
    bindScope(scope);
    expect(() => bindScope(scope)).toThrow(ProvenanceAttributionError);
  });

  it('a second claim does not drain the scope (atomic failure, INV-16)', () => {
    const scope = createSpyScope();
    bindScope(scope);
    scope.read('settings.name');
    expect(() => bindScope(scope)).toThrow(ProvenanceAttributionError);
    expect(scope.drain()).toEqual(['settings.name']);
  });
});

describe('INV-8 — the attribution cursor', () => {
  it('take() = drain ∪ pending ∪ extra and clears pending', () => {
    const scope = createSpyScope();
    const cursor = bindScope(scope);
    scope.read('a');
    cursor.flush();
    scope.read('b');
    expect(cursor.take(['c'])).toEqual(['a', 'b', 'c']);
    expect(cursor.take()).toEqual([]);
  });

  it('take() returns the union verbatim — no pruning, no validation (INV-6)', () => {
    const scope = createSpyScope();
    const cursor = bindScope(scope);
    scope.read('settings', 'settings.name');
    expect(cursor.take(['zzz', '', 'a..b'])).toEqual([
      '',
      'a..b',
      'settings',
      'settings.name',
      'zzz',
    ]);
  });

  it('(a) observe stashes the pre-compute drain into pending and returns only the compute reads', () => {
    const scope = createSpyScope();
    const cursor = bindScope(scope);
    scope.read('a');
    const observed = cursor.observe((config) => {
      scope.read('b');
      return config.settings.decimals;
    });
    expect(observed).toEqual({ value: 7, paths: ['b'] });
    expect(cursor.take()).toEqual(['a']);
  });

  it('(a′) a throwing compute discards its partial reads — the next take() sees only the pre-compute window', () => {
    const scope = createSpyScope();
    const cursor = bindScope(scope);
    scope.read('a');
    const failure = new Error('compute failed');
    expect(() =>
      cursor.observe(() => {
        scope.read('b');
        throw failure;
      })
    ).toThrow(failure);
    // `a` was pending before the compute and stays; `b` shaped no bytes and is gone.
    expect(cursor.take()).toEqual(['a']);
  });

  it('observe twice in a row → each returns its own reads only; observe with no reads → []', () => {
    const scope = createSpyScope();
    const cursor = bindScope(scope);
    const first = cursor.observe(() => {
      scope.read('x');
      return 1;
    });
    const second = cursor.observe(() => {
      scope.read('y');
      return 2;
    });
    const third = cursor.observe(() => 3);
    expect(first.paths).toEqual(['x']);
    expect(second.paths).toEqual(['y']);
    expect(third).toEqual({ value: 3, paths: [] });
  });

  it('(b) flush(extra) moves the window and the explicit paths to pending (Open Q1)', () => {
    const scope = createSpyScope();
    const cursor = bindScope(scope);
    scope.read('a');
    cursor.flush(['explicit']);
    cursor.flush();
    expect(cursor.take()).toEqual(['a', 'explicit']);
  });

  it('a throwing compute propagates the same error object and leaves pending intact', () => {
    const scope = createSpyScope();
    const cursor = bindScope(scope);
    scope.read('a');
    const sentinel = new Error('boom');
    expect(() =>
      cursor.observe(() => {
        throw sentinel;
      })
    ).toThrow(sentinel);
    expect(cursor.take()).toEqual(['a']);
  });
});
