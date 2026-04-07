import { describe, expect, it } from 'vitest';

import { getNestedValue, setNestedValue } from './nestedPath';

describe('getNestedValue', () => {
  it('reads a top-level key', () => {
    expect(getNestedValue({ name: 'hello' }, 'name')).toBe('hello');
  });

  it('reads a nested key', () => {
    expect(getNestedValue({ a: { b: 42 } }, 'a.b')).toBe(42);
  });

  it('reads a deeply nested key', () => {
    expect(getNestedValue({ a: { b: { c: true } } }, 'a.b.c')).toBe(true);
  });

  it('returns undefined for missing top-level key', () => {
    expect(getNestedValue({}, 'missing')).toBeUndefined();
  });

  it('returns undefined for missing nested key', () => {
    expect(getNestedValue({ a: {} }, 'a.b.c')).toBeUndefined();
  });

  it('returns undefined when traversing a non-object', () => {
    expect(getNestedValue({ a: 'string' }, 'a.b')).toBeUndefined();
  });

  it('handles null intermediate values', () => {
    expect(getNestedValue({ a: null } as Record<string, unknown>, 'a.b')).toBeUndefined();
  });
});

describe('setNestedValue', () => {
  it('sets a top-level key', () => {
    expect(setNestedValue('name', 'hello')).toEqual({ name: 'hello' });
  });

  it('sets a nested key', () => {
    expect(setNestedValue('a.b', 42)).toEqual({ a: { b: 42 } });
  });

  it('sets a deeply nested key', () => {
    expect(setNestedValue('a.b.c', true)).toEqual({ a: { b: { c: true } } });
  });

  it('handles undefined value', () => {
    expect(setNestedValue('key', undefined)).toEqual({ key: undefined });
  });

  it('handles boolean value at nested path', () => {
    expect(setNestedValue('documentManager.enabled', true)).toEqual({
      documentManager: { enabled: true },
    });
  });
});
