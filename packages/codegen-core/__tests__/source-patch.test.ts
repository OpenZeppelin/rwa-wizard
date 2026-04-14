import { describe, expect, it } from 'vitest';

import { insertAfterExact, insertBeforeExact, replaceExact } from '../src/source-patch';

describe('Source Patch Helpers', () => {
  it('replaces an exact snippet', () => {
    expect(replaceExact('alpha beta gamma', 'beta', 'BETA')).toBe('alpha BETA gamma');
  });

  it('throws when the exact snippet is missing', () => {
    expect(() => replaceExact('alpha beta gamma', 'delta', 'DELTA')).toThrow(
      'Expected source snippet was not found'
    );
  });

  it('inserts content before an exact marker', () => {
    expect(insertBeforeExact('alpha beta', 'beta', 'BETA ')).toBe('alpha BETA beta');
  });

  it('inserts content after an exact marker', () => {
    expect(insertAfterExact('alpha beta', 'alpha', ' BETA')).toBe('alpha BETA beta');
  });
});
