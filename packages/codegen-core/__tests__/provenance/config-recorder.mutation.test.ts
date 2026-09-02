/**
 * Mutation traps and value hygiene of the recording view.
 * INV-8 (read-only, path-named errors), INV-10 (typed error classes), INV-23 (no values leak).
 * Category: Error Semantics + Sensitive Data Handling.
 */
import { describe, expect, it } from 'vitest';

import { createConfigRecorder } from '../../src/provenance/config-recorder';
import { ProvenanceViewMutationError } from '../../src/provenance/errors';
import type { ProvenanceViewMutation } from '../../src/provenance/errors';

interface Cfg {
  token: { name: string; symbol: string; nested: { deep: number } };
  arr: Array<{ id: string }>;
}

const make = (): Cfg => ({
  token: { name: 'SECRET-NAME', symbol: 'SECRET-SYM', nested: { deep: 1 } },
  arr: [{ id: 'SECRET-ID0' }, { id: 'SECRET-ID1' }],
});

function captureMutation(attempt: () => void): ProvenanceViewMutationError {
  try {
    attempt();
  } catch (error) {
    if (error instanceof ProvenanceViewMutationError) return error;
    throw new Error(`expected ProvenanceViewMutationError, got ${String(error)}`);
  }
  throw new Error('expected the mutation to throw');
}

function expectMutation(
  error: ProvenanceViewMutationError,
  operation: ProvenanceViewMutation,
  path: string
): void {
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe('ProvenanceViewMutationError');
  expect(error.code).toBe('PROVENANCE_VIEW_MUTATION');
  expect(error.operation).toBe(operation);
  expect(error.path).toBe(path);
  expect(error.stack).toBeTruthy();
}

describe('INV-8 — the view is read-only; every mutation throws with the attempted path', () => {
  it('set on a leaf → operation set, path token.name; config unchanged; nothing recorded', () => {
    const config = make();
    const before = structuredClone(config);
    const r = createConfigRecorder(config);
    const token = r.view.token;
    r.drain();

    const error = captureMutation(() => {
      token.name = 'X';
    });
    expectMutation(error, 'set', 'token.name');
    expect(config).toEqual(before);
    expect(config.token.name).toBe('SECRET-NAME');
    expect(r.drain()).toEqual([]);
  });

  it('set of a NEW key → path names the would-be key', () => {
    const r = createConfigRecorder(make());
    const token: Record<string, unknown> = r.view.token;
    r.drain();
    const error = captureMutation(() => {
      token['brandNew'] = 1;
    });
    expectMutation(error, 'set', 'token.brandNew');
    expect(r.drain()).toEqual([]);
  });

  it('delete → operation delete, path token.symbol; config unchanged', () => {
    const config = make();
    const r = createConfigRecorder(config);
    const token = r.view.token;
    r.drain();
    const error = captureMutation(() => {
      Reflect.deleteProperty(token, 'symbol');
    });
    expectMutation(error, 'delete', 'token.symbol');
    expect(config.token.symbol).toBe('SECRET-SYM');
    expect(r.drain()).toEqual([]);
  });

  it('defineProperty → operation define, path token.nested.deep', () => {
    const config = make();
    const r = createConfigRecorder(config);
    const nested = r.view.token.nested;
    r.drain();
    const error = captureMutation(() => {
      Object.defineProperty(nested, 'deep', { value: 2 });
    });
    expectMutation(error, 'define', 'token.nested.deep');
    expect(config.token.nested.deep).toBe(1);
    expect(r.drain()).toEqual([]);
  });

  it('setPrototypeOf → operation setPrototype, path of the view itself', () => {
    const config = make();
    const r = createConfigRecorder(config);
    const token = r.view.token;
    r.drain();
    const error = captureMutation(() => {
      Object.setPrototypeOf(token, null);
    });
    expectMutation(error, 'setPrototype', 'token');
    expect(Object.getPrototypeOf(config.token)).toBe(Object.prototype);
    expect(r.drain()).toEqual([]);
  });

  it('preventExtensions → operation preventExtensions, path token', () => {
    const config = make();
    const r = createConfigRecorder(config);
    const token = r.view.token;
    r.drain();
    const error = captureMutation(() => {
      Object.preventExtensions(token);
    });
    expectMutation(error, 'preventExtensions', 'token');
    expect(Object.isExtensible(config.token)).toBe(true);
    expect(r.drain()).toEqual([]);
  });

  it('a mutation at the ROOT view names the root path', () => {
    const r = createConfigRecorder(make());
    const root: object = r.view;
    const error = captureMutation(() => {
      Reflect.set(root, 'token', {});
    });
    expectMutation(error, 'set', 'token');
    const rootError = captureMutation(() => {
      Object.preventExtensions(root);
    });
    expectMutation(rootError, 'preventExtensions', '');
  });

  it('Object.freeze(view) and Object.seal(view) throw; Object.isFrozen(view) is false even for a frozen config', () => {
    const config = Object.freeze(make());
    const r = createConfigRecorder(config);
    expect(() => Object.freeze(r.view)).toThrowError(ProvenanceViewMutationError);
    expect(() => Object.seal(r.view.token)).toThrowError(ProvenanceViewMutationError);
    expect(Object.isFrozen(r.view)).toBe(false);
  });

  it('view.arr.push(x) throws via set on index N with path arr[N]; array unchanged', () => {
    const config = make();
    const r = createConfigRecorder(config);
    const arr = r.view.arr;
    r.drain();
    const error = captureMutation(() => {
      arr.push({ id: 'new' });
    });
    expect(error.operation).toBe('set');
    expect(['arr[2]', 'arr']).toContain(error.path);
    expect(config.arr).toHaveLength(2);
  });

  it('view.arr.length = 0 throws with path arr', () => {
    const config = make();
    const r = createConfigRecorder(config);
    const error = captureMutation(() => {
      r.view.arr.length = 0;
    });
    expectMutation(error, 'set', 'arr');
    expect(config.arr).toHaveLength(2);
  });

  it('an element write view.arr[0].id = … names arr[0].id', () => {
    const r = createConfigRecorder(make());
    const error = captureMutation(() => {
      const first = r.view.arr[0];
      if (first !== undefined) first.id = 'x';
    });
    expectMutation(error, 'set', 'arr[0].id');
  });

  it('a symbol-keyed write names the view path itself', () => {
    const r = createConfigRecorder(make());
    const token: object = r.view.token;
    const error = captureMutation(() => {
      Reflect.set(token, Symbol('s'), 1);
    });
    expectMutation(error, 'set', 'token');
  });

  it('Object.assign into a view throws (templates cannot "normalise" the config in place)', () => {
    const config = make();
    const r = createConfigRecorder(config);
    expect(() => Object.assign(r.view.token, { name: 'x' })).toThrowError(
      ProvenanceViewMutationError
    );
    expect(config.token.name).toBe('SECRET-NAME');
  });
});

describe('INV-10 — error classes are typed with stable codes', () => {
  it('ProvenanceViewMutationError extends Error, has name, code, path, operation, message and stack', () => {
    const error = new ProvenanceViewMutationError('a.b', 'set');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ProvenanceViewMutationError');
    expect(error.code).toBe('PROVENANCE_VIEW_MUTATION');
    expect(error.path).toBe('a.b');
    expect(error.operation).toBe('set');
    expect(error.message).toContain('a.b');
    expect(error.message).toContain('set');
    expect(typeof error.stack).toBe('string');
  });
});

describe('INV-23 — mutation errors name path and operation, never values', () => {
  it('the message and String(error) contain neither the attempted value nor the current value', () => {
    const r = createConfigRecorder(make());
    const error = captureMutation(() => {
      r.view.token.name = 'SECRET-W';
    });
    for (const text of [error.message, String(error), JSON.stringify({ ...error })]) {
      expect(text).not.toContain('SECRET-W');
      expect(text).not.toContain('SECRET-NAME');
    }
  });

  it('drain()/all() output never contains a config value', () => {
    const r = createConfigRecorder(make());
    JSON.stringify(r.view);
    void r.view.arr.map((x) => x.id);
    const dump = JSON.stringify([r.drain(), r.all()]);
    expect(dump).not.toContain('SECRET-');
  });
});
