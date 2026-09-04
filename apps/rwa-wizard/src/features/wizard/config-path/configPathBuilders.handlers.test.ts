/**
 * SF-6 INV-8 (d), INV-9, INV-16: the pending-entry index is a claim about the
 * wizard's four append handlers, not about `findIndex`. Each handler's array
 * transformation is reproduced here verbatim from its source (the handlers are
 * closures over React state and cannot be imported); the source location is
 * cited on each so a drift in either direction is a one-line diff to check.
 */
import { describe, expect, it } from 'vitest';

import type {
  ClaimTopic,
  ComplianceModuleSelection,
  OperatorRole,
  TrustedIssuer,
} from '@openzeppelin/rwa-config';

import {
  claimTopicIndex,
  moduleIndex,
  nextTrustedIssuerIndex,
  roleIndex,
} from './configPathBuilders';

// ---------------------------------------------------------------------------
// Handler reproductions (pure). Keep byte-for-byte with the cited source.
// ---------------------------------------------------------------------------

/** `ComplianceStep.handleToggleModule` — steps/compliance/ComplianceStep.tsx */
function toggleModule(
  modules: readonly ComplianceModuleSelection[],
  moduleId: string
): ComplianceModuleSelection[] {
  if (modules.some((entry) => entry.moduleId === moduleId)) {
    return modules.filter((entry) => entry.moduleId !== moduleId);
  }
  return [...modules, { moduleId }];
}

/** `OperatorRolesSection.handleSetRoleAddresses` — steps/access-control/OperatorRolesSection.tsx */
function setRoleAddresses(
  roles: readonly OperatorRole[],
  roleName: string,
  addresses: string[]
): OperatorRole[] {
  const otherRoles = roles.filter((role) => role.name !== roleName);
  if (addresses.length === 0) return otherRoles;
  return [...otherRoles, { name: roleName, addresses }];
}

/** `ClaimTopicsSection.handleToggle` (add branch) and `handleAddCustom` — steps/identity/ClaimTopicsSection.tsx */
function toggleTopic(topics: readonly ClaimTopic[], topic: ClaimTopic): ClaimTopic[] {
  const exists = topics.some((t) => t.id === topic.id);
  return exists ? topics.filter((t) => t.id !== topic.id) : [...topics, topic];
}
function addCustomTopic(topics: readonly ClaimTopic[], topic: ClaimTopic): ClaimTopic[] {
  return [...topics, topic];
}

/** `TrustedIssuersSection.handleAdd` — steps/identity/TrustedIssuersSection.tsx */
function addIssuer(issuers: readonly TrustedIssuer[], issuer: TrustedIssuer): TrustedIssuer[] {
  return [...issuers, issuer];
}

// ---------------------------------------------------------------------------

const modules: ComplianceModuleSelection[] = [
  { moduleId: 'supply-limit', config: { limit: 1 } },
  { moduleId: 'max-balance' },
  { moduleId: 'country-restrict' },
];
const roles: OperatorRole[] = [
  { name: 'Manager', addresses: ['G1'] },
  { name: 'Minting', addresses: ['G2'] },
  { name: 'Burning', addresses: ['G3'] },
];
const topics: ClaimTopic[] = [
  { id: 1, name: 'KYC', isCustom: false },
  { id: 2, name: 'AML', isCustom: false },
  { id: 42, name: 'Custom', isCustom: true },
];
const issuers: TrustedIssuer[] = [
  { address: 'GA', claimTopics: [1] },
  { address: 'GB', claimTopics: [] },
];

describe('INV-8 (b): present entries resolve to their position at first, middle and last', () => {
  it('moduleIndex', () => {
    expect(moduleIndex(modules, 'supply-limit')).toBe(0);
    expect(moduleIndex(modules, 'max-balance')).toBe(1);
    expect(moduleIndex(modules, 'country-restrict')).toBe(2);
  });
  it('roleIndex', () => {
    expect(roleIndex(roles, 'Manager')).toBe(0);
    expect(roleIndex(roles, 'Minting')).toBe(1);
    expect(roleIndex(roles, 'Burning')).toBe(2);
  });
  it('claimTopicIndex', () => {
    expect(claimTopicIndex(topics, 1)).toBe(0);
    expect(claimTopicIndex(topics, 2)).toBe(1);
    expect(claimTopicIndex(topics, 42)).toBe(2);
  });
});

describe('INV-8 (a)/(c): absent entries resolve to the append position; never -1, NaN or a throw', () => {
  it.each([
    ['empty modules', () => moduleIndex([], 'x'), 0],
    ['empty roles', () => roleIndex([], 'x'), 0],
    ['empty topics', () => claimTopicIndex([], 99), 0],
    ['empty issuers', () => nextTrustedIssuerIndex([]), 0],
    ['absent module', () => moduleIndex(modules, 'transfer-allow'), 3],
    ['absent role', () => roleIndex(roles, 'Freezing'), 3],
    ['absent topic', () => claimTopicIndex(topics, 3), 3],
    ['issuers', () => nextTrustedIssuerIndex(issuers), 2],
    ['empty-string id', () => moduleIndex(modules, ''), 3],
    ['NaN topic id (matches nothing)', () => claimTopicIndex(topics, Number.NaN), 3],
  ])('%s → %i', (_label, compute, expected) => {
    const value = compute();
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBe(expected);
  });
});

describe('INV-8 (d): the pending index predicts where the real handler puts the entry', () => {
  it('handleToggleModule appends an absent module at the pending index', () => {
    const pending = moduleIndex(modules, 'transfer-allow');
    const after = toggleModule(modules, 'transfer-allow');
    expect(after[pending]?.moduleId).toBe('transfer-allow');
    expect(moduleIndex(after, 'transfer-allow')).toBe(pending);
  });

  it('handleToggleModule from an empty selection lands at 0', () => {
    const pending = moduleIndex([], 'supply-limit');
    expect(toggleModule([], 'supply-limit')[pending]?.moduleId).toBe('supply-limit');
  });

  it('handleSetRoleAddresses appends an absent role at the pending index', () => {
    const pending = roleIndex(roles, 'Freezing');
    const after = setRoleAddresses(roles, 'Freezing', ['G9']);
    expect(after[pending]?.name).toBe('Freezing');
    expect(roleIndex(after, 'Freezing')).toBe(pending);
  });

  it('handleToggle (predefined pill) appends an absent topic at the pending index', () => {
    const topic: ClaimTopic = { id: 3, name: 'Accreditation', isCustom: false };
    const pending = claimTopicIndex(topics, 3);
    const after = toggleTopic(topics, topic);
    expect(after[pending]?.id).toBe(3);
    expect(claimTopicIndex(after, 3)).toBe(pending);
  });

  it('handleAddCustom appends a custom topic at the pending index (the draft inputs share it)', () => {
    const topic: ClaimTopic = { id: 77, name: 'New', isCustom: true };
    const pending = claimTopicIndex(topics, 77);
    expect(pending).toBe(topics.length);
    const after = addCustomTopic(topics, topic);
    expect(after[pending]?.id).toBe(77);
  });

  it('handleAdd appends the issuer at nextTrustedIssuerIndex', () => {
    const pending = nextTrustedIssuerIndex(issuers);
    const after = addIssuer(issuers, { address: 'GC', claimTopics: [1] });
    expect(after[pending]?.address).toBe('GC');
    expect(nextTrustedIssuerIndex(after)).toBe(pending + 1);
  });
});

describe('INV-9: a path is correct only for the config it was computed from', () => {
  it('editing role A when roles are [A, B, C] moves A to the end and shifts B and C down', () => {
    const before = roles;
    const after = setRoleAddresses(before, 'Manager', ['G1', 'G1b']);
    expect(after.map((r) => r.name)).toEqual(['Minting', 'Burning', 'Manager']);
    expect(roleIndex(before, 'Manager')).toBe(0);
    expect(roleIndex(after, 'Manager')).toBe(2);
    // B and C were not touched by the user and their paths changed anyway.
    expect(roleIndex(before, 'Minting')).toBe(1);
    expect(roleIndex(after, 'Minting')).toBe(0);
    expect(roleIndex(before, 'Burning')).toBe(2);
    expect(roleIndex(after, 'Burning')).toBe(1);
  });

  it('clearing role A removes it, so a stale `roles[0]` would now name role B', () => {
    const after = setRoleAddresses(roles, 'Manager', []);
    expect(after[0]?.name).toBe('Minting');
    expect(roleIndex(after, 'Manager')).toBe(after.length); // back to pending
  });

  it('unticking the first module shifts every later module tick down by one', () => {
    const after = toggleModule(modules, 'supply-limit');
    expect(moduleIndex(modules, 'max-balance')).toBe(1);
    expect(moduleIndex(after, 'max-balance')).toBe(0);
    expect(moduleIndex(after, 'supply-limit')).toBe(after.length);
  });

  it('removing a topic shifts later pills and the pending slot down by one', () => {
    const after = toggleTopic(topics, topics[0] as ClaimTopic);
    expect(claimTopicIndex(topics, 42)).toBe(2);
    expect(claimTopicIndex(after, 42)).toBe(1);
    expect(claimTopicIndex(after, 3)).toBe(2); // pending was 3
  });
});

describe('INV-16: index builders are linear and cheap', () => {
  it('moduleIndex over 1,000 entries averages under 1 ms', () => {
    const big: ComplianceModuleSelection[] = Array.from({ length: 1_000 }, (_, i) => ({
      moduleId: `m${i}`,
    }));
    const runs = 100;
    const start = performance.now();
    for (let i = 0; i < runs; i += 1) {
      moduleIndex(big, 'absent');
      moduleIndex(big, `m${i}`);
    }
    const perCall = (performance.now() - start) / (runs * 2);
    expect(perCall).toBeLessThan(1);
  });
});
