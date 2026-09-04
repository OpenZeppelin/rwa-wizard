import { describe, expect, it } from 'vitest';

import { splitPath } from './splitPath';

/**
 * INV-31's unit half: the leaf is what a reader identifies the file by and is
 * never truncated away, and the directory is the only thing distinguishing five
 * generated files all named `contract.rs`. The geometric half — that the heading
 * does not overflow at 260px and the leaf renders in full — is the probe's (V7).
 */
describe('splitPath (INV-31)', () => {
  it('splits a nested path at the last separator', () => {
    expect(splitPath('contracts/rwa-token/src/contract.rs')).toEqual({
      directory: 'contracts/rwa-token/src',
      leaf: 'contract.rs',
    });
  });

  it('returns an empty directory for a root-level file', () => {
    expect(splitPath('README.md')).toEqual({ directory: '', leaf: 'README.md' });
  });

  it('keeps the leaf whole for the longest generated path in the wizard', () => {
    const path = 'contracts/compliance/modules/max-balance/src/contract.rs';
    expect(splitPath(path).leaf).toBe('contract.rs');
    expect(splitPath(path).directory).toBe('contracts/compliance/modules/max-balance/src');
  });

  it('handles a leaf with no extension', () => {
    expect(splitPath('scripts/bootstrap')).toEqual({ directory: 'scripts', leaf: 'bootstrap' });
  });

  it('is total for a trailing separator — an empty leaf, not a throw', () => {
    // Degraded but honest: the heading renders the directory alone. No generator
    // in this repo produces one, and the function must not be the thing that
    // decides that by throwing.
    expect(splitPath('contracts/')).toEqual({ directory: 'contracts', leaf: '' });
  });

  it('is total for the empty string', () => {
    expect(splitPath('')).toEqual({ directory: '', leaf: '' });
  });
});
