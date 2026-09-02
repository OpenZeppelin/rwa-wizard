/**
 * INV-33 / INV-34 / INV-35 — semantic attribution, proved by determination.
 *
 * Byte identity and correct attribution are separate proofs (D10), and Code
 * Draft demonstrated the separation: a deliberately widened `Cargo.toml` member
 * range left all 891 goldens green. These suites are the second proof, and they
 * ask the question a containment check cannot: not "is the value inside the
 * range" but "does the field DETERMINE the lines it claims".
 *
 * Every case here locates lines by content (INV-33) and runs on both generate
 * roots, because the identity path replaces four of the ranged files.
 */
import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createValidConfig } from '../helpers/config';
import {
  entryCoveringLine,
  focusablePaths,
  undeterminedRanges,
  type PathMutation,
} from './determination';
import { GENERATE_PATHS, generateRecorded, rangeEntries, sliceRange, textOf } from './helpers';

const DEPLOY = 'scripts/deploy.sh';
const README = 'README.md';

/** One module selected, so module-shaped blocks exist in the reference. */
const reference = (): RWAConfig =>
  createValidConfig({
    compliance: {
      modules: [{ moduleId: 'country-allow', config: { allowedCountries: ['CH', 'SG'] } }],
    },
  });

const withModules = (modules: RWAConfig['compliance']['modules']): RWAConfig =>
  createValidConfig({ compliance: { modules } });

const withToken = (token: Partial<RWAConfig['token']>): RWAConfig =>
  createValidConfig({ compliance: reference().compliance, token });

/** Everything but the named slice held at the reference value. */
const withOverride = (overrides: Parameters<typeof createValidConfig>[0]): RWAConfig =>
  createValidConfig({ compliance: reference().compliance, ...overrides });

const withRoles = (roles: RWAConfig['accessControl']['roles']): RWAConfig =>
  withOverride({ accessControl: { roles } });

const REFERENCE_ROLES = reference().accessControl.roles;

/** The reference roles with entry `index` replaced. */
const roleAt = (index: number, addresses: string[]): RWAConfig =>
  withRoles(REFERENCE_ROLES.map((role, at) => (at === index ? { ...role, addresses } : role)));

const REFERENCE_TOPICS = reference().identityVerification.claimTopics;

const topicAt = (index: number, name: string): RWAConfig =>
  withOverride({
    identityVerification: {
      claimTopics: REFERENCE_TOPICS.map((topic, at) => (at === index ? { ...topic, name } : topic)),
    },
  });

const issuerAt = (
  index: number,
  issuer: Partial<RWAConfig['identityVerification']['trustedIssuers'][number]>
): RWAConfig =>
  withOverride({
    identityVerification: {
      trustedIssuers: reference().identityVerification.trustedIssuers.map((entry, at) =>
        at === index ? { ...entry, ...issuer } : entry
      ),
    },
  });

/**
 * The mutation sets. Each entry changes ONLY its own path relative to
 * `reference()`, and each set is plural on purpose: a field may shape a block
 * only under a configuration the baseline does not reach, and a range is honest
 * if ANY mutation of its path moves a line inside it.
 *
 * Membership arrays get BOTH a value mutation and an emptiness mutation,
 * because those are different dependencies and only the second one moves the
 * contract. That distinction is the whole of the operator-role address bug: a
 * method guard depends on whether a role has members, never on which address
 * they are, and for want of an emptiness mutation the value mutation alone
 * would have reported honest ranges as broken while an over-claiming range
 * that only the value mutation can catch went unnoticed for want of a case.
 */
const DETERMINATION_CASES: readonly {
  readonly configPath: Parameters<typeof undeterminedRanges>[2];
  readonly mutations: readonly PathMutation[];
}[] = [
  {
    configPath: 'token.name',
    mutations: [{ label: 'renamed', config: withToken({ name: 'Zeta Holdings Trust' }) }],
  },
  {
    configPath: 'token.symbol',
    mutations: [{ label: 'resymbolled', config: withToken({ symbol: 'ZHT' }) }],
  },
  {
    configPath: 'token.decimals',
    mutations: [{ label: 'six decimals', config: withToken({ decimals: 6 }) }],
  },
  {
    // Two different dependencies: `deploy.sh` renders the amount, while the
    // demo-mint script and its README sections exist at all only when a supply
    // is set. A value mutation alone cannot clear the second kind.
    configPath: 'token.initialSupply',
    mutations: [
      { label: 'a smaller supply', config: withToken({ initialSupply: '4200000000000000000' }) },
      { label: 'no initial supply', config: withToken({ initialSupply: undefined }) },
    ],
  },
  {
    configPath: 'token.documentManager.enabled',
    mutations: [
      { label: 'document manager off', config: withToken({ documentManager: { enabled: false } }) },
    ],
  },
  {
    // The discriminant cannot move on its own: each variant carries a different
    // address member, so switching the model necessarily rewrites the address
    // too. That is also the only thing a user can actually do at the model
    // selector, so the mutation matches the gesture rather than an unreachable
    // isolation of the discriminant.
    configPath: 'accessControl.ownership.type',
    mutations: [
      {
        label: 'multi-sig',
        config: withOverride({
          accessControl: { ownership: { type: 'multi-sig', address: 'GCMULTISIGOWNER' } },
        }),
      },
    ],
  },
  {
    configPath: 'accessControl.ownership.ownerAddress',
    mutations: [
      {
        label: 'different owner',
        config: withOverride({
          accessControl: { ownership: { type: 'single-owner', ownerAddress: 'GCDIFFERENTOWNER' } },
        }),
      },
    ],
  },
  ...REFERENCE_ROLES.map((_role, index) => ({
    configPath: `accessControl.roles[${index}].addresses` as const,
    mutations: [
      { label: 'a different member address', config: roleAt(index, ['GCROTATEDMEMBER']) },
      { label: 'a second member', config: roleAt(index, ['GCEXAMPLEMGR', 'GCSECONDMEMBER']) },
      { label: 'no members at all', config: roleAt(index, []) },
    ],
  })),
  ...REFERENCE_TOPICS.map((_topic, index) => ({
    configPath: `identityVerification.claimTopics[${index}]` as const,
    // The id is referenced by the trusted issuer, so moving it alone fails
    // validation; the name is the part of the entry that is free to move.
    mutations: [{ label: 'renamed topic', config: topicAt(index, 'Sanctions') }],
  })),
  {
    configPath: 'identityVerification.trustedIssuers[0].address',
    mutations: [
      { label: 'a different issuer address', config: issuerAt(0, { address: 'GCOTHERISSUERADDR' }) },
    ],
  },
  {
    configPath: 'identityVerification.trustedIssuers[0].claimTopics',
    mutations: [{ label: 'one topic instead of two', config: issuerAt(0, { claimTopics: [1] }) }],
  },
  {
    configPath: 'identityVerification.trustedIssuers',
    mutations: [
      {
        label: 'a second issuer',
        config: withOverride({
          identityVerification: {
            trustedIssuers: [
              { address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] },
              { address: 'GCEXAMPLEISSUER2', claimTopics: [1] },
            ],
          },
        }),
      },
      { label: 'a different issuer address', config: issuerAt(0, { address: 'GCOTHERISSUERADDR' }) },
    ],
  },
  {
    configPath: 'compliance.modules[0]',
    mutations: [
      {
        label: 'a different module',
        config: withModules([{ moduleId: 'max-balance', config: { maxBalance: 50_000 } }]),
      },
      { label: 'no modules', config: withModules([]) },
    ],
  },
  {
    configPath: 'compliance.modules[0].config.allowedCountries',
    mutations: [
      {
        label: 'different countries',
        config: withModules([
          { moduleId: 'country-allow', config: { allowedCountries: ['DE', 'FR', 'IT'] } },
        ]),
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Coverage — an omitted path is a failure, not a silent gap
 *
 * The oracle proves nothing about a path nobody thought to mutate. Enumerating
 * the focusable surface from the config and diffing it against the table above
 * turns "we forgot operator-role addresses" from an invisible omission into a
 * red test.
 * ------------------------------------------------------------------ */
describe('the mutation table covers every path the wizard can focus', () => {
  const covered = new Set<string>(DETERMINATION_CASES.map((entry) => entry.configPath));

  it('leaves no focusable path without a mutation', () => {
    expect(focusablePaths(reference()).filter((path) => !covered.has(path))).toEqual([]);
  });

  it('enumerates a surface that actually spans the config', () => {
    // Guards the guard: an enumeration that collapsed to a handful of scalars
    // would make the assertion above pass vacuously.
    const surface = focusablePaths(reference());

    expect(surface.length).toBeGreaterThanOrEqual(14);
    for (const prefix of [
      'accessControl.roles[',
      'identityVerification.claimTopics[',
      'identityVerification.trustedIssuers[',
      'compliance.modules[',
    ]) {
      expect(surface.some((path) => path.startsWith(prefix))).toBe(true);
    }
  });

  it('gives every case at least one mutation', () => {
    for (const entry of DETERMINATION_CASES) expect(entry.mutations.length).toBeGreaterThan(0);
  });
});

describe.each(GENERATE_PATHS)('$name — every claimed range is determined by its field', (path) => {
  it.each(DETERMINATION_CASES)(
    'no range claiming $configPath survives every mutation of it',
    ({ configPath, mutations }) => {
      expect(undeterminedRanges(path, reference(), configPath, mutations)).toEqual([]);
    }
  );

  /**
   * The oracle's own negative control. Without this, a bug that made
   * `undeterminedRanges` always return `[]` would turn every case above green.
   * A range claiming `token.name` cannot be determined by mutating `decimals`,
   * so feeding the wrong mutation set MUST produce findings.
   */
  it('reports findings when a path is checked against a mutation that cannot move it', () => {
    const wrongMutations = [{ label: 'decimals, not name', config: withToken({ decimals: 6 }) }];

    expect(
      undeterminedRanges(path, reference(), 'token.name', wrongMutations).length
    ).toBeGreaterThan(0);
  });

  it('refuses to pass vacuously when no mutation is supplied', () => {
    expect(() => undeterminedRanges(path, reference(), 'token.name', [])).toThrow(
      /would pass vacuously/
    );
  });
});

/* ------------------------------------------------------------------ *
 * INV-35 / INV-24 — a section heading belongs to its own section
 *
 * `deploy.sh` emits Claim Topics and Trusted Issuers as adjacent sections. A
 * `for…of` over a config array performs one more iterator read AFTER the last
 * body emission; that trailing read has no emission of its own to land on, so
 * it drains onto the NEXT one — the following section's heading. Code Draft
 * found and fixed this on the trusted-issuers loop; these assert it for both
 * sections, in both directions, so the fix cannot regress on one side only.
 * ------------------------------------------------------------------ */
describe.each(GENERATE_PATHS)('$name — deploy.sh section headings', (path) => {
  it('does not attribute the Trusted Issuers heading to claim topics', () => {
    const covering = entryCoveringLine(path, reference(), DEPLOY, 'Trusted Issuers (');

    expect(covering.paths.filter((p) => p.startsWith('identityVerification.claimTopics'))).toEqual(
      []
    );
  });

  it('does not attribute the Claim Topics heading to trusted issuers', () => {
    const covering = entryCoveringLine(path, reference(), DEPLOY, 'Claim Topics (');

    expect(
      covering.paths.filter((p) => p.startsWith('identityVerification.trustedIssuers'))
    ).toEqual([]);
  });

  it('does not attribute the Compliance Module Wiring heading to claim topics or issuers', () => {
    const covering = entryCoveringLine(path, reference(), DEPLOY, 'Compliance Module Wiring (');

    expect(covering.paths.filter((p) => p.startsWith('identityVerification'))).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * INV-37 — a block that renders empty carries no attribution
 *
 * `renderSelectedModules` returns `''` when nothing is selected, and its span
 * shares a line with `### Upstream Provenance`, so it can only ride the merged
 * block. INV-37's resolution is that the merged block may carry the paths
 * *because the block exists on account of those selections* — which is true
 * only when a selection was made. With none, the block exists regardless, and
 * claiming it tells the user that ticking a module rewrites the Platform Note:
 * INV-34's own violation scenario, word for word.
 * ------------------------------------------------------------------ */
describe.each(GENERATE_PATHS)('$name — README merged provenance block', (path) => {
  it('claims no compliance path at all when no module is selected', () => {
    const covering = entryCoveringLine(path, withModules([]), README, '### Upstream Provenance');

    expect(covering.paths.filter((p) => p.startsWith('compliance.'))).toEqual([]);
  });

  it('claims the module paths when a module IS selected, and shows the module', () => {
    const covering = entryCoveringLine(
      path,
      withModules([{ moduleId: 'max-balance', config: { maxBalance: 50_000 } }]),
      README,
      '### Upstream Provenance'
    );

    expect(covering.paths.some((p) => p.startsWith('compliance.modules'))).toBe(true);
    expect(covering.lines.some((line) => line.includes('max-balance'))).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * INV-33 — positive containment for the required dimension list
 * ------------------------------------------------------------------ */
describe.each(GENERATE_PATHS)('$name — positive containment', (path) => {
  const positives: readonly {
    readonly dimension: Parameters<typeof undeterminedRanges>[2];
    readonly filePath: string;
    readonly needle: string;
  }[] = [
    { dimension: 'token.name', filePath: README, needle: 'Acme Real Estate Token' },
    { dimension: 'token.symbol', filePath: README, needle: 'ACME' },
    { dimension: 'token.name', filePath: DEPLOY, needle: 'Acme Real Estate Token' },
    { dimension: 'token.decimals', filePath: DEPLOY, needle: 'Decimals:  18' },
    {
      dimension: 'accessControl.ownership.ownerAddress',
      filePath: DEPLOY,
      needle: 'GCEXAMPLEOWNER',
    },
    {
      dimension: 'identityVerification.trustedIssuers[0].address',
      filePath: DEPLOY,
      needle: 'GCEXAMPLEISSUER1',
    },
    {
      dimension: 'compliance.modules[0].moduleId',
      filePath: DEPLOY,
      needle: 'compliance_country_allow.wasm',
    },
  ];

  it.each(positives)(
    '$dimension has a range on $filePath holding its value',
    ({ dimension, filePath, needle }) => {
      const { files, provenance } = generateRecorded(path, reference());
      const content = textOf(files, filePath);

      const holding = rangeEntries(provenance, filePath)
        .filter((entry) => entry.paths.includes(dimension))
        .filter((entry) => sliceRange(content, entry.range).some((line) => line.includes(needle)));

      expect(holding.length).toBeGreaterThan(0);
    }
  );
});
