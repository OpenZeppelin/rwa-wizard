import { describe, expect, it } from 'vitest';

import type {
  ClaimTopic,
  ComplianceModuleSelection,
  OperatorRole,
  RWAConfig,
  TrustedIssuer,
} from '@openzeppelin/rwa-config';

import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { claimTopicIndex, moduleIndex, roleIndex, trustedIssuerIndex } from '../config-path';
import { anchorItemExists, anchorToConfigPath } from './anchorToConfigPath';
import {
  adminAnchor,
  CLAIM_TOPIC_DRAFT_ANCHOR,
  claimTopicAnchor,
  identityControlAnchor,
  ISSUER_DRAFT_ANCHOR,
  issuerAnchor,
  issuerTopicsAnchor,
  moduleAnchor,
  moduleConfigAnchor,
  OWNERSHIP_ADDRESS_ANCHOR,
  OWNERSHIP_TYPE_ANCHOR,
  parseConfigAnchor,
  roleAnchor,
  tokenAnchor,
  type ConfigAnchor,
} from './configAnchor';

/**
 * SF-14 INV-9 (`anchorItemExists` is total, exhaustive, and reads exactly the
 * five slices `anchorToConfigPath` reads) and INV-10 (existence and resolution
 * agree — the subject never names a pending index).
 *
 * The structure mirrors `anchorToConfigPath.test.ts`, and deliberately so: the
 * two functions must read the same five slices, so the one-input-at-a-time
 * enumeration is the same enumeration.
 */

function decode(key: string): ConfigAnchor {
  const anchor = parseConfigAnchor(key);
  if (anchor === null) throw new Error(`fixture key ${key} does not decode`);
  return anchor;
}

function draftWith(overrides: {
  ownership?: RWAConfig['accessControl']['ownership'];
  roles?: OperatorRole[];
  modules?: ComplianceModuleSelection[];
  claimTopics?: ClaimTopic[];
  trustedIssuers?: TrustedIssuer[];
}): RWAConfig {
  const base = createDefaultRwaConfig();
  return {
    ...base,
    accessControl: {
      ownership: overrides.ownership ?? base.accessControl.ownership,
      roles: overrides.roles ?? [],
    },
    compliance: { modules: overrides.modules ?? [] },
    identityVerification: {
      ...base.identityVerification,
      claimTopics: overrides.claimTopics ?? [],
      trustedIssuers: overrides.trustedIssuers ?? [],
    },
  };
}

const POPULATED = draftWith({
  ownership: { type: 'single-owner', ownerAddress: 'GOWNER' },
  roles: [
    { name: 'Manager', addresses: ['GM'] },
    { name: 'Agent', addresses: ['GA'] },
  ],
  modules: [{ moduleId: 'supply-limit' }, { moduleId: 'transfer-allow' }],
  claimTopics: [
    { id: 1, name: 'KYC' },
    { id: 2, name: 'AML' },
  ],
  trustedIssuers: [
    { address: 'GAAA', claimTopics: [1] },
    { address: 'GBBB', claimTopics: [2] },
  ],
});

const EMPTY = draftWith({});

// ---------------------------------------------------------------------------
// INV-9 — one case per arm, thirteen of them
// ---------------------------------------------------------------------------

describe('anchorItemExists — one case per arm (INV-9)', () => {
  const tested = new Set<ConfigAnchor['kind']>();

  function assertArm(anchor: ConfigAnchor, config: RWAConfig, expected: boolean): void {
    tested.add(anchor.kind);
    expect(anchorItemExists(anchor, config)).toBe(expected);
  }

  /**
   * The five that are not items. A token field, an administrative control, an
   * identity control and both ownership locations exist for every draft — so
   * they are `true` even for the empty one, which is what "cannot be absent"
   * means operationally.
   */
  it('token is true, even for an empty draft', () => {
    assertArm(decode(tokenAnchor('name')), EMPTY, true);
    expect(anchorItemExists(decode(tokenAnchor('name')), POPULATED)).toBe(true);
  });
  it('admin is true, even for an empty draft', () =>
    assertArm(decode(adminAnchor('burnable')), EMPTY, true));
  it('identityControl is true, even for an empty draft', () =>
    assertArm(decode(identityControlAnchor('recovery')), EMPTY, true));
  it('ownershipType is true, even for an empty draft', () =>
    assertArm(decode(OWNERSHIP_TYPE_ANCHOR), EMPTY, true));
  it('ownershipAddress is true, even for an empty draft', () =>
    assertArm(decode(OWNERSHIP_ADDRESS_ANCHOR), EMPTY, true));

  it('role is true iff the role name is present', () => {
    assertArm(decode(roleAnchor('Manager')), POPULATED, true);
    expect(anchorItemExists(decode(roleAnchor('Manager')), EMPTY)).toBe(false);
    expect(anchorItemExists(decode(roleAnchor('Nobody')), POPULATED)).toBe(false);
  });

  it('module is true iff the module id is selected', () => {
    assertArm(decode(moduleAnchor('transfer-allow')), POPULATED, true);
    expect(anchorItemExists(decode(moduleAnchor('transfer-allow')), EMPTY)).toBe(false);
  });

  /**
   * Keyed on the **module's presence**, never on its config record. A
   * `moduleConfig` arm that read `modules[i].config` would throw on a module
   * whose config record is absent — inside render, in the drawer. A partner to a
   * function documented never to throw must not be the one that does.
   */
  it('moduleConfig is keyed on the module, not on its config record', () => {
    assertArm(decode(moduleConfigAnchor('transfer-allow', 'allowedUsers')), POPULATED, true);
    // The module is selected with **no** `config` key at all.
    expect(
      anchorItemExists(
        decode(moduleConfigAnchor('transfer-allow', 'anything-at-all')),
        draftWith({ modules: [{ moduleId: 'transfer-allow' }] })
      )
    ).toBe(true);
    expect(anchorItemExists(decode(moduleConfigAnchor('nope', 'x')), POPULATED)).toBe(false);
  });

  it('claimTopic is true iff the topic id is present', () => {
    assertArm(decode(claimTopicAnchor(1)), POPULATED, true);
    expect(anchorItemExists(decode(claimTopicAnchor(1)), EMPTY)).toBe(false);
    expect(anchorItemExists(decode(claimTopicAnchor(99)), POPULATED)).toBe(false);
  });

  it('issuer is true iff the address is present', () => {
    assertArm(decode(issuerAnchor('GAAA')), POPULATED, true);
    expect(anchorItemExists(decode(issuerAnchor('GAAA')), EMPTY)).toBe(false);
  });

  it('issuerTopics is true iff the issuer is present', () => {
    assertArm(decode(issuerTopicsAnchor('GBBB')), POPULATED, true);
    expect(anchorItemExists(decode(issuerTopicsAnchor('GZZZ')), POPULATED)).toBe(false);
  });

  /**
   * The two draft anchors are `false` for every draft, so this and
   * `isInspectableAnchor` agree on them **without either calling the other**.
   * Two independent refusals, so removing one does not silently remove both.
   */
  it('claimTopicDraft is false, for every draft', () => {
    assertArm(decode(CLAIM_TOPIC_DRAFT_ANCHOR), POPULATED, false);
    expect(anchorItemExists(decode(CLAIM_TOPIC_DRAFT_ANCHOR), EMPTY)).toBe(false);
  });
  it('issuerDraft is false, for every draft', () => {
    assertArm(decode(ISSUER_DRAFT_ANCHOR), POPULATED, false);
    expect(anchorItemExists(decode(ISSUER_DRAFT_ANCHOR), EMPTY)).toBe(false);
  });

  it('covers all thirteen kinds — a fourteenth needs a decision here', () => {
    expect([...tested].sort()).toEqual(
      [
        'admin',
        'claimTopic',
        'claimTopicDraft',
        'identityControl',
        'issuer',
        'issuerDraft',
        'issuerTopics',
        'module',
        'moduleConfig',
        'ownershipAddress',
        'ownershipType',
        'role',
        'token',
      ].sort()
    );
  });
});

// ---------------------------------------------------------------------------
// INV-9 — one test per draft slice, varying only that slice
// ---------------------------------------------------------------------------

/**
 * The standing one-input-at-a-time rule, discharged the same way SF-12 INV-17
 * discharged it for the resolver. Each case holds the anchor fixed and moves a
 * single slice; the "unaffected" half is what says the function reads *only* the
 * slice it should. A `role` arm that consulted `compliance.modules` would pass
 * every arm test above and fail here.
 */
describe('anchorItemExists reads exactly five draft slices, one at a time (INV-9)', () => {
  const cases = [
    {
      slice: 'accessControl.roles',
      anchor: decode(roleAnchor('Manager')),
      present: draftWith({ roles: [{ name: 'Manager', addresses: ['G'] }] }),
      absent: draftWith({ roles: [{ name: 'Agent', addresses: ['G'] }] }),
    },
    {
      slice: 'compliance.modules',
      anchor: decode(moduleAnchor('transfer-allow')),
      present: draftWith({ modules: [{ moduleId: 'transfer-allow' }] }),
      absent: draftWith({ modules: [{ moduleId: 'supply-limit' }] }),
    },
    {
      slice: 'identityVerification.claimTopics',
      anchor: decode(claimTopicAnchor(1)),
      present: draftWith({ claimTopics: [{ id: 1, name: 'KYC' }] }),
      absent: draftWith({ claimTopics: [{ id: 2, name: 'AML' }] }),
    },
    {
      slice: 'identityVerification.trustedIssuers',
      anchor: decode(issuerAnchor('GAAA')),
      present: draftWith({ trustedIssuers: [{ address: 'GAAA', claimTopics: [] }] }),
      absent: draftWith({ trustedIssuers: [{ address: 'GBBB', claimTopics: [] }] }),
    },
  ] as const;

  it.each(cases)('$slice alone decides the answer', ({ anchor, present, absent }) => {
    expect(anchorItemExists(anchor, present)).toBe(true);
    expect(anchorItemExists(anchor, absent)).toBe(false);
  });

  /**
   * The fifth slice, `accessControl.ownership`, is read by `anchorToConfigPath`
   * and **not** by this function: ownership always exists, whichever variant is
   * selected. Asserted rather than omitted, because "reads the same five" would
   * otherwise be an unchecked claim about the one slice where the two functions
   * legitimately differ in what they do with it.
   */
  it.each([
    ['single-owner', { type: 'single-owner', ownerAddress: 'G' }],
    ['multi-sig', { type: 'multi-sig', address: 'G' }],
    ['dao', { type: 'dao', address: 'G' }],
  ] as const)('accessControl.ownership never changes existence — %s', (_variant, ownership) => {
    expect(anchorItemExists(decode(OWNERSHIP_ADDRESS_ANCHOR), draftWith({ ownership }))).toBe(true);
    expect(anchorItemExists(decode(OWNERSHIP_TYPE_ANCHOR), draftWith({ ownership }))).toBe(true);
    // …while resolution does depend on it, which is why the slice is read there.
    expect(
      anchorToConfigPath(decode(OWNERSHIP_ADDRESS_ANCHOR), draftWith({ ownership }))
    ).toContain('accessControl.ownership');
  });

  it('a slice the anchor does not name never changes the answer', () => {
    const anchor = decode(claimTopicAnchor(1));
    const base = draftWith({ claimTopics: [{ id: 1, name: 'KYC' }] });
    const noisy = draftWith({
      claimTopics: [{ id: 1, name: 'KYC' }],
      roles: [{ name: 'Manager', addresses: ['G'] }],
      modules: [{ moduleId: 'transfer-allow' }],
      trustedIssuers: [{ address: 'GAAA', claimTopics: [] }],
      ownership: { type: 'dao', address: 'G' },
    });
    expect(anchorItemExists(anchor, base)).toBe(anchorItemExists(anchor, noisy));
  });
});

// ---------------------------------------------------------------------------
// INV-10 — existence and resolution agree
// ---------------------------------------------------------------------------

/**
 * The failure this closes, and it is not hypothetical: `pendingIndex` never
 * returns `-1`, so a removed claim topic's anchor resolves cleanly to
 * `claimTopics[length]` — a **different, later** item's slot. Measured against
 * real Stellar output, a pending trusted-issuer slot returns a *non-empty*
 * provenance group, so the wrong answer renders as a populated, confident list
 * rather than as an obvious blank.
 *
 * Existence is therefore expressed *through the resolver's own index helpers*
 * — `index < entries.length` — so the two cannot drift into a second, parallel
 * definition that disagrees.
 */
describe('existence and resolution agree, for every keyed kind (INV-10)', () => {
  const keyed = [
    {
      kind: 'role',
      anchor: decode(roleAnchor('Manager')),
      present: draftWith({ roles: [{ name: 'Manager', addresses: ['G'] }] }),
      absent: draftWith({ roles: [] }),
      indexOf: (config: RWAConfig) => ({
        index: roleIndex(config.accessControl.roles, 'Manager'),
        length: config.accessControl.roles.length,
      }),
    },
    {
      kind: 'module',
      anchor: decode(moduleAnchor('transfer-allow')),
      present: draftWith({ modules: [{ moduleId: 'transfer-allow' }] }),
      absent: draftWith({ modules: [] }),
      indexOf: (config: RWAConfig) => ({
        index: moduleIndex(config.compliance.modules, 'transfer-allow'),
        length: config.compliance.modules.length,
      }),
    },
    {
      kind: 'moduleConfig',
      anchor: decode(moduleConfigAnchor('transfer-allow', 'allowedUsers')),
      present: draftWith({ modules: [{ moduleId: 'transfer-allow' }] }),
      absent: draftWith({ modules: [] }),
      indexOf: (config: RWAConfig) => ({
        index: moduleIndex(config.compliance.modules, 'transfer-allow'),
        length: config.compliance.modules.length,
      }),
    },
    {
      kind: 'claimTopic',
      anchor: decode(claimTopicAnchor(1)),
      present: draftWith({ claimTopics: [{ id: 1, name: 'KYC' }] }),
      absent: draftWith({ claimTopics: [] }),
      indexOf: (config: RWAConfig) => ({
        index: claimTopicIndex(config.identityVerification.claimTopics, 1),
        length: config.identityVerification.claimTopics.length,
      }),
    },
    {
      kind: 'issuer',
      anchor: decode(issuerAnchor('GAAA')),
      present: draftWith({ trustedIssuers: [{ address: 'GAAA', claimTopics: [] }] }),
      absent: draftWith({ trustedIssuers: [] }),
      indexOf: (config: RWAConfig) => ({
        index: trustedIssuerIndex(config.identityVerification.trustedIssuers, 'GAAA'),
        length: config.identityVerification.trustedIssuers.length,
      }),
    },
    {
      kind: 'issuerTopics',
      anchor: decode(issuerTopicsAnchor('GAAA')),
      present: draftWith({ trustedIssuers: [{ address: 'GAAA', claimTopics: [] }] }),
      absent: draftWith({ trustedIssuers: [] }),
      indexOf: (config: RWAConfig) => ({
        index: trustedIssuerIndex(config.identityVerification.trustedIssuers, 'GAAA'),
        length: config.identityVerification.trustedIssuers.length,
      }),
    },
  ] as const;

  it.each(keyed)('$kind — existence agrees with the index helper, present and absent', (row) => {
    for (const [config, expected] of [
      [row.present, true],
      [row.absent, false],
    ] as const) {
      const { index, length } = row.indexOf(config);
      expect(anchorItemExists(row.anchor, config)).toBe(expected);
      expect(index < length, `${row.kind}: index ${index} vs length ${length}`).toBe(expected);
      // The helper never signals absence with `-1`; it returns the pending slot.
      expect(index).toBeGreaterThanOrEqual(0);
      if (!expected) expect(index).toBe(length);
    }
  });

  /**
   * Stated once as the property itself: whenever existence is false, resolution
   * still returns a path — and it is the pending one. That is exactly the
   * confident-looking wrong answer the read-time check exists to suppress, and
   * asserting that resolution *does* produce it is what stops this test passing
   * because resolution happened to return `null`.
   */
  it.each(keyed)('$kind — when the item is absent, resolution still names a slot', (row) => {
    expect(anchorItemExists(row.anchor, row.absent)).toBe(false);
    const path = anchorToConfigPath(row.anchor, row.absent);
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Totality
// ---------------------------------------------------------------------------

describe('anchorItemExists is total and never throws (INV-9)', () => {
  const anchors: readonly ConfigAnchor[] = [
    decode(tokenAnchor('name')),
    decode(adminAnchor('burnable')),
    decode(identityControlAnchor('recovery')),
    decode(OWNERSHIP_TYPE_ANCHOR),
    decode(OWNERSHIP_ADDRESS_ANCHOR),
    decode(roleAnchor('Manager')),
    decode(moduleAnchor('transfer-allow')),
    decode(moduleConfigAnchor('transfer-allow', 'allowedUsers')),
    decode(claimTopicAnchor(1)),
    decode(CLAIM_TOPIC_DRAFT_ANCHOR),
    decode(issuerAnchor('GAAA')),
    decode(issuerTopicsAnchor('GAAA')),
    decode(ISSUER_DRAFT_ANCHOR),
  ];

  it('returns a boolean for every kind against every draft shape', () => {
    for (const config of [EMPTY, POPULATED]) {
      for (const anchor of anchors) {
        expect(() => anchorItemExists(anchor, config)).not.toThrow();
        expect(typeof anchorItemExists(anchor, config)).toBe('boolean');
      }
    }
  });

  it('does not mutate the draft', () => {
    const deepFreeze = <T>(value: T): T => {
      if (value === null || typeof value !== 'object') return value;
      Object.freeze(value);
      for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry);
      return value;
    };
    const frozen = deepFreeze(draftWith({ claimTopics: [{ id: 1, name: 'KYC' }] }));
    for (const anchor of anchors) {
      expect(() => anchorItemExists(anchor, frozen)).not.toThrow();
    }
  });
});
