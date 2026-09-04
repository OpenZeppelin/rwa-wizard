import { describe, expect, it } from 'vitest';

import type { ClaimTopic, ComplianceModuleSelection, OperatorRole } from '@openzeppelin/rwa-config';

import { parseConfigPath } from './configPath';
import {
  administrativeControlPath,
  claimTopicIndex,
  claimTopicPath,
  identityControlPath,
  moduleConfigFieldPath,
  moduleEntryPath,
  moduleIndex,
  nextTrustedIssuerIndex,
  ownershipAddressPath,
  ownershipTypePath,
  roleAddressesPath,
  roleIndex,
  tokenPaths,
  trustedIssuerAddressPath,
  trustedIssuerClaimTopicsPath,
} from './configPathBuilders';

describe('constant paths (INV-12)', () => {
  it('are frozen literals', () => {
    expect(Object.isFrozen(tokenPaths)).toBe(true);
    expect(tokenPaths).toStrictEqual({
      name: 'token.name',
      symbol: 'token.symbol',
      decimals: 'token.decimals',
      initialSupply: 'token.initialSupply',
      documentManagerEnabled: 'token.documentManager.enabled',
    });
    expect(ownershipTypePath).toBe('accessControl.ownership.type');
  });
});

describe('meta-id paths (INV-6)', () => {
  it('splice the id as a single key', () => {
    expect(administrativeControlPath('burnable')).toBe('token.administrativeControls.burnable');
    expect(identityControlPath('recovery')).toBe('identityVerification.controls.recovery');
  });

  it('does not protect against a dotted key — the registry test is load-bearing', () => {
    expect(parseConfigPath(moduleConfigFieldPath(0, 'a.b'))).toHaveLength(6);
  });
});

describe('ownershipAddressPath (INV-10)', () => {
  it('follows the variant', () => {
    expect(ownershipAddressPath({ type: 'single-owner', ownerAddress: '' })).toBe(
      'accessControl.ownership.ownerAddress'
    );
    expect(ownershipAddressPath({ type: 'multi-sig', address: '' })).toBe(
      'accessControl.ownership.address'
    );
    expect(ownershipAddressPath({ type: 'dao', address: '' })).toBe(
      'accessControl.ownership.address'
    );
  });
});

describe('indexed builders (INV-11)', () => {
  it.each([0, 1, 9, 10, 999])('emit index %i verbatim and parse back', (i) => {
    const cases = [
      [trustedIssuerAddressPath(i), `identityVerification.trustedIssuers[${i}].address`],
      [trustedIssuerClaimTopicsPath(i), `identityVerification.trustedIssuers[${i}].claimTopics`],
      [claimTopicPath(i), `identityVerification.claimTopics[${i}]`],
      [moduleEntryPath(i), `compliance.modules[${i}]`],
      [moduleConfigFieldPath(i, 'limit'), `compliance.modules[${i}].config.limit`],
      [roleAddressesPath(i), `accessControl.roles[${i}].addresses`],
    ] as const;
    for (const [actual, expected] of cases) {
      expect(actual).toBe(expected);
      const indexSegment = parseConfigPath(actual).find((s) => s.kind === 'index');
      expect(indexSegment).toEqual({ kind: 'index', index: i });
    }
  });
});

describe('pending-entry index (INV-8)', () => {
  const modules: ComplianceModuleSelection[] = [
    { moduleId: 'a' },
    { moduleId: 'b' },
    { moduleId: 'c' },
  ];
  const roles: OperatorRole[] = [
    { name: 'A', addresses: ['1'] },
    { name: 'B', addresses: ['2'] },
  ];
  const topics: ClaimTopic[] = [
    { id: 1, name: 'x' },
    { id: 7, name: 'y' },
  ];

  it('returns the current position when present', () => {
    expect(moduleIndex(modules, 'a')).toBe(0);
    expect(moduleIndex(modules, 'b')).toBe(1);
    expect(moduleIndex(modules, 'c')).toBe(2);
    expect(roleIndex(roles, 'B')).toBe(1);
    expect(claimTopicIndex(topics, 7)).toBe(1);
  });

  it('returns the append position when absent, including on an empty array', () => {
    expect(moduleIndex(modules, 'zzz')).toBe(3);
    expect(moduleIndex([], 'zzz')).toBe(0);
    expect(roleIndex([], 'A')).toBe(0);
    expect(claimTopicIndex(topics, 99)).toBe(2);
    expect(nextTrustedIssuerIndex([])).toBe(0);
    expect(nextTrustedIssuerIndex([{ address: 'A', claimTopics: [] }])).toBe(1);
  });

  it('predicts the append handler: the module lands where the pending index said (INV-8d)', () => {
    const pending = moduleIndex(modules, 'd');
    // handleToggleModule's transformation for an absent module.
    const after = [...modules, { moduleId: 'd' }];
    expect(after[pending]?.moduleId).toBe('d');
  });

  it('is correct only for the config it was computed from — roles reorder (INV-9)', () => {
    // handleSetRoleAddresses filters-then-appends.
    const editA = (list: OperatorRole[], addresses: string[]): OperatorRole[] => [
      ...list.filter((role) => role.name !== 'A'),
      { name: 'A', addresses },
    ];
    const after = editA(roles, ['9']);
    expect(roleIndex(roles, 'A')).toBe(0);
    expect(roleIndex(after, 'A')).toBe(1);
    expect(roleIndex(roles, 'B')).toBe(1);
    expect(roleIndex(after, 'B')).toBe(0);
  });
});
