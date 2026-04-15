import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import {
  getAdditionalRoleAssignments,
  getAdminAddress,
  getManagerAddress,
  getResolvedRoleAssignments,
} from '../src/access-control';

function createConfig(overrides: Partial<RWAConfig['accessControl']> = {}): Pick<RWAConfig, 'accessControl'> {
  return {
    accessControl: {
      ownership: {
        type: 'single-owner',
        ownerAddress: 'GADMIN',
      },
      roles: [],
      ...overrides,
    },
  };
}

describe('RWA Access Control Helpers', () => {
  describe('getAdminAddress', () => {
    it('returns the single-owner address for single-owner configs', () => {
      expect(getAdminAddress(createConfig())).toBe('GADMIN');
    });

    it('returns the shared ownership address for multi-sig configs', () => {
      expect(
        getAdminAddress(
          createConfig({
            ownership: {
              type: 'multi-sig',
              address: 'GMULTISIG',
            },
          })
        )
      ).toBe('GMULTISIG');
    });
  });

  describe('getResolvedRoleAssignments', () => {
    it('keeps explicit role symbols and skips empty role addresses', () => {
      expect(
        getResolvedRoleAssignments(
          createConfig({
            roles: [
              { name: 'Operator', symbol: 'ops', addresses: ['GOPS'] },
              { name: 'Ignored', addresses: ['   '] },
            ],
          })
        )
      ).toEqual([{ name: 'Operator', symbol: 'ops', addresses: ['GOPS'] }]);
    });

    it('uses shared default symbols for well-known roles', () => {
      expect(
        getResolvedRoleAssignments(
          createConfig({
            roles: [{ name: 'Manager', addresses: ['GMANAGER'] }],
          })
        )
      ).toEqual([{ name: 'Manager', symbol: 'manager', addresses: ['GMANAGER'] }]);
    });

    it('uses a generator callback for chain-specific fallback symbols', () => {
      expect(
        getResolvedRoleAssignments(
          createConfig({
            roles: [{ name: 'Compliance Officer', addresses: ['GCO'] }],
          }),
          {
            generateRoleSymbol: (name) => name.toLowerCase().replace(/\s+/g, '-'),
          }
        )
      ).toEqual([
        { name: 'Compliance Officer', symbol: 'compliance-officer', addresses: ['GCO'] },
      ]);
    });

    it('throws when a custom role is missing both a symbol and a generator', () => {
      expect(() =>
        getResolvedRoleAssignments(
          createConfig({
            roles: [{ name: 'Compliance Officer', addresses: ['GCO'] }],
          })
        )
      ).toThrow('Role "Compliance Officer" is missing a symbol');
    });

    it('preserves multiple addresses for the same role', () => {
      expect(
        getResolvedRoleAssignments(
          createConfig({
            roles: [{ name: 'Minter', symbol: 'minter', addresses: ['GMINTER1', 'GMINTER2'] }],
          })
        )
      ).toEqual([{ name: 'Minter', symbol: 'minter', addresses: ['GMINTER1', 'GMINTER2'] }]);
    });
  });

  describe('getManagerAddress', () => {
    it('returns the manager role address when configured', () => {
      expect(
        getManagerAddress(
          createConfig({
            roles: [{ name: 'Manager', addresses: ['GMANAGER'] }],
          })
        )
      ).toBe('GMANAGER');
    });

    it('falls back to the admin address when no manager role exists', () => {
      expect(
        getManagerAddress(
          createConfig({
            roles: [{ name: 'Operator', symbol: 'ops', addresses: ['GOPS'] }],
          })
        )
      ).toBe('GADMIN');
    });
  });

  describe('getAdditionalRoleAssignments', () => {
    it('excludes the manager role from additional assignments', () => {
      expect(
        getAdditionalRoleAssignments(
          createConfig({
            roles: [
              { name: 'Manager', addresses: ['GMANAGER'] },
              { name: 'Operator', symbol: 'ops', addresses: ['GOPS'] },
            ],
          })
        )
      ).toEqual([{ name: 'Operator', symbol: 'ops', addresses: ['GOPS'] }]);
    });
  });
});
