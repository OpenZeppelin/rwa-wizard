import { describe, expect, it } from 'vitest';

import type {
  ClaimTopic,
  ComplianceModuleSelection,
  OperatorRole,
  RWAConfig,
  TrustedIssuer,
} from '@openzeppelin/rwa-config';

import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { anchorToConfigPath } from './anchorToConfigPath';
import type { ConfigAnchor } from './configAnchor';

/**
 * INV-17 (resolution is draft-current, one test per index-bearing shape) and
 * INV-18 (constant-path anchors read no slice).
 *
 * The two are complements: an anchor must read what it needs and must not read
 * what it does not. They are the substance of this repo's standing memo rule
 * applied to `anchorToConfigPath` — the function has two inputs, and `config`
 * decomposes into exactly five slices, so each block below varies one slice and
 * holds the anchor fixed.
 */

// ---------------------------------------------------------------------------
// Handler reproductions, kept byte-for-byte with their cited source.
//
// The handlers are closures over React state and cannot be imported. Reproducing
// them is what makes row 3 and row 6 assertions about the wizard's *actual*
// index mechanics rather than about `findIndex`.
// ---------------------------------------------------------------------------

/** `OperatorRolesSection.handleSetRoleAddresses` — steps/access-control/OperatorRolesSection.tsx:38-50 */
function setRoleAddresses(
  roles: readonly OperatorRole[],
  roleName: string,
  addresses: string[]
): OperatorRole[] {
  const otherRoles = roles.filter((role) => role.name !== roleName);
  if (addresses.length === 0) return otherRoles;
  return [...otherRoles, { name: roleName, addresses }];
}

/** `TrustedIssuersSection.handleRemove` — steps/identity/TrustedIssuersSection.tsx:84-88 */
function removeIssuer(issuers: readonly TrustedIssuer[], index: number): TrustedIssuer[] {
  return issuers.filter((_, i) => i !== index);
}

// ---------------------------------------------------------------------------

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

const ISSUER_A = 'GAAA';
const ISSUER_B = 'GBBB';
const ISSUER_C = 'GCCC';

const issuer = (address: string): TrustedIssuer => ({ address, claimTopics: [] });

// ---------------------------------------------------------------------------
// Row 1: the anchor varies, the draft is fixed. Every kind yields its path.
// ---------------------------------------------------------------------------

describe('INV-17 row 1 — each of the thirteen kinds yields its documented path', () => {
  const draft = draftWith({
    ownership: { type: 'single-owner', ownerAddress: 'GOWNER' },
    roles: [{ name: 'Manager', addresses: ['GM'] }],
    modules: [{ moduleId: 'supply-limit' }, { moduleId: 'transfer-allow' }],
    claimTopics: [{ id: 1, name: 'KYC' }],
    trustedIssuers: [issuer(ISSUER_A)],
  });

  const cases: ReadonlyArray<readonly [ConfigAnchor, string]> = [
    [{ kind: 'token', field: 'name' }, 'token.name'],
    [{ kind: 'token', field: 'documentManagerEnabled' }, 'token.documentManager.enabled'],
    [{ kind: 'admin', controlId: 'burnable' }, 'token.administrativeControls.burnable'],
    [{ kind: 'identityControl', controlId: 'recovery' }, 'identityVerification.controls.recovery'],
    [{ kind: 'ownershipType' }, 'accessControl.ownership.type'],
    [{ kind: 'ownershipAddress' }, 'accessControl.ownership.ownerAddress'],
    [{ kind: 'role', roleName: 'Manager' }, 'accessControl.roles[0].addresses'],
    [{ kind: 'module', moduleId: 'transfer-allow' }, 'compliance.modules[1]'],
    [
      { kind: 'moduleConfig', moduleId: 'transfer-allow', fieldKey: 'allowedUsers' },
      'compliance.modules[1].config.allowedUsers',
    ],
    [{ kind: 'claimTopic', topicId: 1 }, 'identityVerification.claimTopics[0]'],
    [{ kind: 'claimTopicDraft' }, 'identityVerification.claimTopics[1]'],
    [{ kind: 'issuer', address: ISSUER_A }, 'identityVerification.trustedIssuers[0]'],
    [
      { kind: 'issuerTopics', address: ISSUER_A },
      'identityVerification.trustedIssuers[0].claimTopics',
    ],
    [{ kind: 'issuerDraft' }, 'identityVerification.trustedIssuers[1]'],
  ];

  it.each(cases)('%o → %s', (anchor, expected) => {
    expect(anchorToConfigPath(anchor, draft)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Row 2: `accessControl.ownership` varies. AS-1 clause 2.
// ---------------------------------------------------------------------------

describe('INV-17 row 2 — one DOM element, three paths (AS-1 clause 2)', () => {
  const anchor: ConfigAnchor = { kind: 'ownershipAddress' };

  it.each([
    [{ type: 'single-owner', ownerAddress: 'G' } as const, 'accessControl.ownership.ownerAddress'],
    [{ type: 'multi-sig', address: 'G' } as const, 'accessControl.ownership.address'],
    [{ type: 'dao', address: 'G' } as const, 'accessControl.ownership.address'],
  ])('%o → %s', (ownership, expected) => {
    expect(anchorToConfigPath(anchor, draftWith({ ownership }))).toBe(expected);
  });

  it('keeps `ownershipType` constant across the same three variants', () => {
    const paths = (['single-owner', 'multi-sig', 'dao'] as const).map((type) =>
      anchorToConfigPath(
        { kind: 'ownershipType' },
        draftWith({
          ownership: type === 'single-owner' ? { type, ownerAddress: 'G' } : { type, address: 'G' },
        })
      )
    );
    expect(new Set(paths).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Row 3: `accessControl.roles`, through the real filter-then-append handler.
// ---------------------------------------------------------------------------

describe('INV-17 row 3 — role indices track the live array', () => {
  const anchor: ConfigAnchor = { kind: 'role', roleName: 'Minting' };

  it('an absent role resolves to the pending index (the array length)', () => {
    expect(anchorToConfigPath(anchor, draftWith({ roles: [] }))).toBe(
      'accessControl.roles[0].addresses'
    );
    expect(
      anchorToConfigPath(anchor, draftWith({ roles: [{ name: 'Manager', addresses: ['G'] }] }))
    ).toBe('accessControl.roles[1].addresses');
  });

  it('resolves at index 0 and at index 2', () => {
    const atZero = [{ name: 'Minting', addresses: ['G'] }];
    const atTwo = [
      { name: 'Manager', addresses: ['G'] },
      { name: 'Burning', addresses: ['G'] },
      { name: 'Minting', addresses: ['G'] },
    ];
    expect(anchorToConfigPath(anchor, draftWith({ roles: atZero }))).toBe(
      'accessControl.roles[0].addresses'
    );
    expect(anchorToConfigPath(anchor, draftWith({ roles: atTwo }))).toBe(
      'accessControl.roles[2].addresses'
    );
  });

  /**
   * The mutation the invariant names, and the whole reason a role anchor carries
   * a *name* rather than a render index: `handleSetRoleAddresses` filters the
   * edited role out and appends it, so editing role A moves A to the end and
   * shifts every role that was after it one position down.
   *
   * A resolver that had captured an index at render time would now be pointing
   * at a different role, and every path it produced would still parse and still
   * resolve — the failure is silent by construction, which is why it gets its
   * own test rather than a comment.
   */
  it('follows the filter-then-append shift when *another* role is edited', () => {
    const before: OperatorRole[] = [
      { name: 'Manager', addresses: ['GM'] },
      { name: 'Minting', addresses: ['GMINT'] },
      { name: 'Burning', addresses: ['GB'] },
    ];
    expect(anchorToConfigPath(anchor, draftWith({ roles: before }))).toBe(
      'accessControl.roles[1].addresses'
    );

    // Edit *Manager*, not Minting. Manager moves to the end; Minting shifts to 0.
    const after = setRoleAddresses(before, 'Manager', ['GM', 'GM2']);
    expect(after.map((role) => role.name)).toEqual(['Minting', 'Burning', 'Manager']);
    expect(anchorToConfigPath(anchor, draftWith({ roles: after }))).toBe(
      'accessControl.roles[0].addresses'
    );
  });

  it('follows the edited role to the end of the array', () => {
    const before: OperatorRole[] = [
      { name: 'Minting', addresses: ['GMINT'] },
      { name: 'Manager', addresses: ['GM'] },
    ];
    const after = setRoleAddresses(before, 'Minting', ['GMINT', 'GX']);
    expect(anchorToConfigPath(anchor, draftWith({ roles: after }))).toBe(
      'accessControl.roles[1].addresses'
    );
  });

  it('returns to the pending index when the role is cleared to zero addresses', () => {
    const before: OperatorRole[] = [
      { name: 'Manager', addresses: ['GM'] },
      { name: 'Minting', addresses: ['GMINT'] },
    ];
    const after = setRoleAddresses(before, 'Minting', []);
    expect(after.map((role) => role.name)).toEqual(['Manager']);
    expect(anchorToConfigPath(anchor, draftWith({ roles: after }))).toBe(
      'accessControl.roles[1].addresses'
    );
  });
});

// ---------------------------------------------------------------------------
// Row 4: `compliance.modules`. AS-1 clause 3.
// ---------------------------------------------------------------------------

describe('INV-17 row 4 — module indices track the live array', () => {
  const entryAnchor: ConfigAnchor = { kind: 'module', moduleId: 'transfer-allow' };
  const fieldAnchor: ConfigAnchor = {
    kind: 'moduleConfig',
    moduleId: 'transfer-allow',
    fieldKey: 'allowedUsers',
  };
  const mod = (moduleId: string): ComplianceModuleSelection => ({ moduleId });

  it('an unselected module resolves to the pending index', () => {
    const modules = [mod('supply-limit'), mod('max-balance')];
    expect(anchorToConfigPath(entryAnchor, draftWith({ modules }))).toBe('compliance.modules[2]');
    expect(anchorToConfigPath(fieldAnchor, draftWith({ modules }))).toBe(
      'compliance.modules[2].config.allowedUsers'
    );
  });

  it('resolves at index 0 and at index 3', () => {
    expect(anchorToConfigPath(entryAnchor, draftWith({ modules: [mod('transfer-allow')] }))).toBe(
      'compliance.modules[0]'
    );
    const atThree = [
      mod('supply-limit'),
      mod('max-balance'),
      mod('country-allow'),
      mod('transfer-allow'),
    ];
    expect(anchorToConfigPath(entryAnchor, draftWith({ modules: atThree }))).toBe(
      'compliance.modules[3]'
    );
    expect(anchorToConfigPath(fieldAnchor, draftWith({ modules: atThree }))).toBe(
      'compliance.modules[3].config.allowedUsers'
    );
  });

  it('follows a reorder in the same call', () => {
    const before = [mod('supply-limit'), mod('transfer-allow'), mod('max-balance')];
    const after = [mod('max-balance'), mod('transfer-allow'), mod('supply-limit')];
    const reversed = [...before].reverse();

    expect(anchorToConfigPath(entryAnchor, draftWith({ modules: before }))).toBe(
      'compliance.modules[1]'
    );
    expect(anchorToConfigPath(entryAnchor, draftWith({ modules: after }))).toBe(
      'compliance.modules[1]'
    );
    expect(anchorToConfigPath(entryAnchor, draftWith({ modules: reversed }))).toBe(
      'compliance.modules[1]'
    );
  });

  it('moves when an earlier module is removed', () => {
    const before = [mod('supply-limit'), mod('transfer-allow')];
    const after = before.filter((entry) => entry.moduleId !== 'supply-limit');
    expect(anchorToConfigPath(entryAnchor, draftWith({ modules: before }))).toBe(
      'compliance.modules[1]'
    );
    expect(anchorToConfigPath(entryAnchor, draftWith({ modules: after }))).toBe(
      'compliance.modules[0]'
    );
  });
});

// ---------------------------------------------------------------------------
// Row 5: `identityVerification.claimTopics`.
// ---------------------------------------------------------------------------

describe('INV-17 row 5 — claim-topic indices track the live array', () => {
  const anchor: ConfigAnchor = { kind: 'claimTopic', topicId: 2 };
  const topic = (id: number): ClaimTopic => ({ id, name: `T${id}` });

  it('an unselected topic resolves to the pending index', () => {
    expect(anchorToConfigPath(anchor, draftWith({ claimTopics: [] }))).toBe(
      'identityVerification.claimTopics[0]'
    );
    expect(anchorToConfigPath(anchor, draftWith({ claimTopics: [topic(1)] }))).toBe(
      'identityVerification.claimTopics[1]'
    );
  });

  it('resolves at index 0 and at index 2', () => {
    expect(anchorToConfigPath(anchor, draftWith({ claimTopics: [topic(2)] }))).toBe(
      'identityVerification.claimTopics[0]'
    );
    expect(
      anchorToConfigPath(anchor, draftWith({ claimTopics: [topic(1), topic(3), topic(2)] }))
    ).toBe('identityVerification.claimTopics[2]');
  });

  it('moves when an earlier topic is removed', () => {
    const before = [topic(1), topic(2)];
    const after = before.filter((entry) => entry.id !== 1);
    expect(anchorToConfigPath(anchor, draftWith({ claimTopics: before }))).toBe(
      'identityVerification.claimTopics[1]'
    );
    expect(anchorToConfigPath(anchor, draftWith({ claimTopics: after }))).toBe(
      'identityVerification.claimTopics[0]'
    );
  });

  it('`claimTopicDraft` always lands on `topics.length`', () => {
    const anchorDraft: ConfigAnchor = { kind: 'claimTopicDraft' };
    for (const count of [0, 1, 5]) {
      const topics = Array.from({ length: count }, (_, i) => topic(i + 1));
      expect(anchorToConfigPath(anchorDraft, draftWith({ claimTopics: topics }))).toBe(
        `identityVerification.claimTopics[${count}]`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Row 6: `identityVerification.trustedIssuers`, through the real remove handler.
// ---------------------------------------------------------------------------

describe('INV-17 row 6 — issuer indices are identity-keyed and recomputed', () => {
  const anchor: ConfigAnchor = { kind: 'issuer', address: ISSUER_C };
  const topicsAnchor: ConfigAnchor = { kind: 'issuerTopics', address: ISSUER_C };

  it('an absent issuer resolves to the pending index', () => {
    expect(anchorToConfigPath(anchor, draftWith({ trustedIssuers: [] }))).toBe(
      'identityVerification.trustedIssuers[0]'
    );
  });

  it('resolves first and third', () => {
    expect(anchorToConfigPath(anchor, draftWith({ trustedIssuers: [issuer(ISSUER_C)] }))).toBe(
      'identityVerification.trustedIssuers[0]'
    );
    const third = [issuer(ISSUER_A), issuer(ISSUER_B), issuer(ISSUER_C)];
    expect(anchorToConfigPath(anchor, draftWith({ trustedIssuers: third }))).toBe(
      'identityVerification.trustedIssuers[2]'
    );
    expect(anchorToConfigPath(topicsAnchor, draftWith({ trustedIssuers: third }))).toBe(
      'identityVerification.trustedIssuers[2].claimTopics'
    );
  });

  /**
   * The address is the key precisely so this case is correct. Removing the first
   * issuer shifts every later row's index; an anchor carrying the render index
   * would keep pointing at the position and therefore at a *different* issuer,
   * and the resulting path would resolve to a real entry — confidently wrong,
   * with nothing to notice it.
   */
  it('recomputes when an earlier issuer is removed, through the real handler', () => {
    const before = [issuer(ISSUER_A), issuer(ISSUER_B), issuer(ISSUER_C)];
    expect(anchorToConfigPath(anchor, draftWith({ trustedIssuers: before }))).toBe(
      'identityVerification.trustedIssuers[2]'
    );

    const after = removeIssuer(before, 0);
    expect(after.map((entry) => entry.address)).toEqual([ISSUER_B, ISSUER_C]);
    expect(anchorToConfigPath(anchor, draftWith({ trustedIssuers: after }))).toBe(
      'identityVerification.trustedIssuers[1]'
    );
    expect(anchorToConfigPath(topicsAnchor, draftWith({ trustedIssuers: after }))).toBe(
      'identityVerification.trustedIssuers[1].claimTopics'
    );
  });

  it('`issuerDraft` always lands on `issuers.length`', () => {
    const anchorDraft: ConfigAnchor = { kind: 'issuerDraft' };
    for (const count of [0, 1, 3]) {
      const issuers = Array.from({ length: count }, (_, i) => issuer(`G${i}`));
      expect(anchorToConfigPath(anchorDraft, draftWith({ trustedIssuers: issuers }))).toBe(
        `identityVerification.trustedIssuers[${count}]`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// INV-18: the complement.
// ---------------------------------------------------------------------------

describe('INV-18 — constant-path anchors read no draft slice', () => {
  const constantAnchors: readonly ConfigAnchor[] = [
    { kind: 'token', field: 'name' },
    { kind: 'token', field: 'symbol' },
    { kind: 'token', field: 'decimals' },
    { kind: 'token', field: 'initialSupply' },
    { kind: 'token', field: 'documentManagerEnabled' },
    { kind: 'admin', controlId: 'burnable' },
    { kind: 'admin', controlId: 'mintable' },
    { kind: 'identityControl', controlId: 'recovery' },
    { kind: 'ownershipType' },
  ];

  /** Five drafts whose every index-bearing slice differs. */
  const drafts: readonly RWAConfig[] = [
    draftWith({}),
    draftWith({
      ownership: { type: 'dao', address: 'GDAO' },
      roles: [{ name: 'Manager', addresses: ['G'] }],
      modules: [{ moduleId: 'supply-limit' }],
      claimTopics: [{ id: 1, name: 'KYC' }],
      trustedIssuers: [issuer(ISSUER_A)],
    }),
    draftWith({
      ownership: { type: 'multi-sig', address: 'GMS' },
      roles: [
        { name: 'Burning', addresses: ['G'] },
        { name: 'Manager', addresses: ['G'] },
      ],
      modules: [{ moduleId: 'transfer-allow' }, { moduleId: 'supply-limit' }],
      claimTopics: [
        { id: 3, name: 'C' },
        { id: 1, name: 'KYC' },
      ],
      trustedIssuers: [issuer(ISSUER_B), issuer(ISSUER_A)],
    }),
    draftWith({ roles: [], modules: [], claimTopics: [], trustedIssuers: [] }),
    draftWith({
      modules: Array.from({ length: 7 }, (_, i) => ({ moduleId: `m-${i}` })),
      claimTopics: Array.from({ length: 9 }, (_, i) => ({ id: i, name: `t${i}` })),
      trustedIssuers: Array.from({ length: 4 }, (_, i) => issuer(`G${i}`)),
    }),
  ];

  it.each(constantAnchors)('%o answers identically for every draft', (anchor) => {
    const answers = drafts.map((draft) => anchorToConfigPath(anchor, draft));
    expect(new Set(answers).size).toBe(1);
  });
});

describe('anchorToConfigPath is pure', () => {
  it('does not mutate the draft', () => {
    const draft = draftWith({
      roles: [{ name: 'Manager', addresses: ['G'] }],
      modules: [{ moduleId: 'transfer-allow' }],
      claimTopics: [{ id: 1, name: 'KYC' }],
      trustedIssuers: [issuer(ISSUER_A)],
    });
    const snapshot = JSON.stringify(draft);

    for (const anchor of [
      { kind: 'role', roleName: 'Manager' },
      { kind: 'module', moduleId: 'transfer-allow' },
      { kind: 'claimTopic', topicId: 1 },
      { kind: 'issuer', address: ISSUER_A },
      { kind: 'issuerDraft' },
    ] as const) {
      anchorToConfigPath(anchor, draft);
    }

    expect(JSON.stringify(draft)).toBe(snapshot);
  });

  it('is referentially transparent — two calls agree', () => {
    const draft = draftWith({ modules: [{ moduleId: 'transfer-allow' }] });
    const anchor: ConfigAnchor = { kind: 'module', moduleId: 'transfer-allow' };
    expect(anchorToConfigPath(anchor, draft)).toBe(anchorToConfigPath(anchor, draft));
  });
});
