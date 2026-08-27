import { describe, expect, it } from 'vitest';

import { fileContentsEqual } from './fileContentsEqual';

describe('fileContentsEqual (INV-7)', () => {
  it('returns true for identical strings', () => {
    expect(fileContentsEqual('deploy.sh', 'deploy.sh')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(
      fileContentsEqual('v1', 'v2'),
      'INV-7: unequal string contents must not compare as changed-file equal'
    ).toBe(false);
  });

  it('returns true for Uint8Array with equal bytes', () => {
    const left = new Uint8Array([0, 255, 128]);
    const right = new Uint8Array([0, 255, 128]);
    expect(fileContentsEqual(left, right)).toBe(true);
  });

  it('returns false for Uint8Array with different length or bytes', () => {
    const base = new Uint8Array([1, 2, 3]);
    expect(fileContentsEqual(base, new Uint8Array([1, 2]))).toBe(false);
    expect(fileContentsEqual(base, new Uint8Array([1, 2, 4]))).toBe(false);
  });

  it('returns false for mixed string vs Uint8Array without coercion', () => {
    const bytes = new TextEncoder().encode('hello');
    expect(fileContentsEqual('hello', bytes), 'INV-7: mixed types must not coerce to equal').toBe(
      false
    );
    expect(fileContentsEqual(bytes, 'hello')).toBe(false);
  });

  it('returns false when either side is undefined', () => {
    expect(fileContentsEqual(undefined, 'x')).toBe(false);
    expect(fileContentsEqual('x', undefined)).toBe(false);
    expect(fileContentsEqual(undefined, undefined)).toBe(false);
  });
});
