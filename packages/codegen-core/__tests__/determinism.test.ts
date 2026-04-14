import { describe, expect, it } from 'vitest';

import { computeConfigHash, hashString, sortObjectKeys, stableJsonStringify } from '../src/determinism';

describe('Determinism Utilities', () => {
  describe('sortObjectKeys', () => {
    it('sorts nested object keys recursively', () => {
      expect(
        sortObjectKeys({
          z: 1,
          a: {
            c: 3,
            b: 2,
          },
        })
      ).toEqual({
        a: {
          b: 2,
          c: 3,
        },
        z: 1,
      });
    });

    it('preserves array order while sorting nested object items', () => {
      expect(
        sortObjectKeys([
          { b: 2, a: 1 },
          { d: 4, c: 3 },
        ])
      ).toEqual([
        { a: 1, b: 2 },
        { c: 3, d: 4 },
      ]);
    });
  });

  describe('stableJsonStringify', () => {
    it('produces identical JSON for differently ordered objects', () => {
      const left = { token: { symbol: 'ABC', name: 'Alpha' }, deployment: { network: 'testnet' } };
      const right = { deployment: { network: 'testnet' }, token: { name: 'Alpha', symbol: 'ABC' } };

      expect(stableJsonStringify(left)).toBe(stableJsonStringify(right));
    });
  });

  describe('hashString', () => {
    it('returns the same digest for the same input', () => {
      expect(hashString('hello world')).toBe(hashString('hello world'));
    });

    it('returns different digests for different input', () => {
      expect(hashString('alpha')).not.toBe(hashString('bravo'));
    });
  });

  describe('computeConfigHash', () => {
    it('ignores object key order when hashing config-like values', () => {
      const left = {
        token: { symbol: 'ABC', name: 'Alpha' },
        compliance: { modules: [{ moduleId: 'supply-limit', config: { limit: 10 } }] },
      };
      const right = {
        compliance: { modules: [{ config: { limit: 10 }, moduleId: 'supply-limit' }] },
        token: { name: 'Alpha', symbol: 'ABC' },
      };

      expect(computeConfigHash(left)).toBe(computeConfigHash(right));
    });
  });
});
