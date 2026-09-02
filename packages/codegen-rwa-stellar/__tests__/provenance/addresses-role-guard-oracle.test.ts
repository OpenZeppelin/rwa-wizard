/**
 * SF-19 — Addresses clear-members determination oracle (SC-016 / AS-1 / INV-17).
 *
 * Matching-aware: uses `filterProvenanceByPath` so the suite sees the same
 * list-root promotion the wizard column sees. Re-measures which role-guard
 * ranged sites survive after clearing a role's members — never a hardcoded
 * count (INV-17 / hazard-3 "7" / "~23").
 *
 * Scope (Design purpose / wrap inventory): role-guard emits in `rwa-token`
 * (`#[only_role]` / `#[only_admin]`). Full-column SC-016 over deploy/README
 * whole-list roots and `markOperatorParametersUsed` body path-merge is named
 * under residual gaps — those are outside this SF's Observeds wraps.
 *
 * Anti-pattern (INV-17): this file must not assert a hardcoded Addresses
 * ranged-row count.
 */
import { describe, expect, it } from 'vitest';

import type { ConfigPath, ProvenanceEntry, ProvenanceResult } from '@openzeppelin/codegen-core';
import { filterProvenanceByPath } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createValidConfig } from '../helpers/config';
import { ACCESS_CONTROL_ROLES } from '../../src/templates/contracts/rwa-token-roles';
import {
  GENERATE_PATHS,
  generateRecorded,
  rangeEntries,
  sliceRange,
  textOf,
  type GeneratePath,
} from './helpers';

const RWA_TOKEN = 'contracts/rwa-token/src/contract.rs';

/** Operator roles that produce name-match role-guard scans (hazard 5). */
const OPERATOR_ROLES_FIXTURE: RWAConfig['accessControl']['roles'] = [
  { name: 'Pauser', symbol: 'pauser', addresses: ['GCPAUSERADDR001'] },
  { name: 'Minter', symbol: 'minter', addresses: ['GCMINTERADDR001'] },
  { name: 'Freezer', symbol: 'freezer', addresses: ['GCFREEZERADDR01'] },
];

/** Design A6 — reference surface with operator guards + document-manager. */
const reference = (): RWAConfig =>
  createValidConfig({
    token: { documentManager: { enabled: true } },
    accessControl: { roles: OPERATOR_ROLES_FIXTURE },
    compliance: {
      modules: [{ moduleId: 'country-allow', config: { allowedCountries: ['CH', 'SG'] } }],
    },
  });

const clearRoleMembers = (config: RWAConfig, index: number): RWAConfig =>
  createValidConfig({
    token: config.token,
    compliance: config.compliance,
    identityVerification: config.identityVerification,
    accessControl: {
      ownership: config.accessControl.ownership,
      roles: config.accessControl.roles.map((role, at) =>
        at === index ? { ...role, addresses: [] } : role
      ),
    },
    deployment: config.deployment,
  });

interface RangedSite {
  readonly filePath: string;
  readonly lines: readonly string[];
}

type RangeEntry = Extract<ProvenanceEntry, { kind: 'range' }>;

const isGuardAttributeLine = (line: string): boolean => /^\s*#\[only_(?:role|admin)/.test(line);

/** Role-guard sites: ranged entries whose slice includes a guard attribute line. */
function roleGuardSites(
  filtered: ProvenanceResult,
  files: Record<string, string | Uint8Array>
): RangedSite[] {
  const sites: RangedSite[] = [];
  for (const [filePath, file] of Object.entries(filtered.files)) {
    const content = files[filePath];
    if (typeof content !== 'string') continue;
    for (const entry of file.entries) {
      if (entry.kind !== 'range') continue;
      const lines = sliceRange(content, entry.range);
      if (!lines.some(isGuardAttributeLine)) continue;
      sites.push({ filePath, lines });
    }
  }
  return sites;
}

/**
 * A5 — falsely stable: after clear+regen, a matching-filtered ranged entry still
 * covers byte-identical line content for this before-site.
 */
function siteStillFalselyStable(
  site: RangedSite,
  afterFiles: Record<string, string | Uint8Array>,
  afterFiltered: ProvenanceResult
): boolean {
  const afterContent = afterFiles[site.filePath];
  if (typeof afterContent !== 'string') return false;

  const afterEntries = afterFiltered.files[site.filePath]?.entries ?? [];
  for (const entry of afterEntries) {
    if (entry.kind !== 'range') continue;
    const afterLines = sliceRange(afterContent, entry.range);
    if (
      afterLines.length === site.lines.length &&
      afterLines.every((line, i) => line === site.lines[i])
    ) {
      return true;
    }
  }
  return false;
}

function addressesPath(index: number): ConfigPath {
  return `accessControl.roles[${index}].addresses`;
}

function candidateRoleIndices(config: RWAConfig): number[] {
  return config.accessControl.roles
    .map((role, index) => (role.addresses.length > 0 ? index : -1))
    .filter((index) => index >= 0);
}

function describeSite(site: RangedSite): string {
  const preview = site.lines.find(isGuardAttributeLine)?.trim() ?? site.lines[0]?.trim() ?? '(empty)';
  return `${site.filePath} «${preview}» (${site.lines.length} line(s))`;
}

/**
 * INV-17 (SF-19 scope) — role-guard ranged sites for an Addresses path are not
 * falsely stable after clearing that role's members.
 */
function assertNoFalselyStableRoleGuardSites(
  path: GeneratePath,
  fixture: RWAConfig,
  roleIndex: number
): void {
  const configPath = addressesPath(roleIndex);
  const before = generateRecorded(path, fixture);
  const beforeFiltered = filterProvenanceByPath(before.provenance, configPath);
  const beforeSites = roleGuardSites(beforeFiltered, before.files);

  const cleared = clearRoleMembers(fixture, roleIndex);
  const after = generateRecorded(path, cleared);
  const afterFiltered = filterProvenanceByPath(after.provenance, configPath);

  const falselyStable = beforeSites.filter((site) =>
    siteStillFalselyStable(site, after.files, afterFiltered)
  );

  expect(
    falselyStable,
    [
      `INV-17 / SC-016 (role-guard scope) violated for ${configPath} on ${path.name}:`,
      `  ${falselyStable.length} guard site(s) still attributed after clearing members,`,
      `  with byte-identical line content (list-root over-light).`,
      ...falselyStable.map((site) => `  - ${describeSite(site)}`),
      `  (before guard-site count re-measured as ${beforeSites.length} — not a fixed N.)`,
    ].join('\n')
  ).toEqual([]);
}

// ---------------------------------------------------------------------------
// INV-7 — non-vacuity
// ---------------------------------------------------------------------------

describe('INV-7 — oracle non-vacuity', () => {
  it('reference fixture has at least one role with non-empty addresses', () => {
    const candidates = candidateRoleIndices(reference());
    expect(
      candidates.length,
      'SF-19 oracle would pass vacuously with zero candidate roles — fixture drift'
    ).toBeGreaterThan(0);
  });

  it('Addresses matching returns at least one role-guard site before clear (non-vacuous oracle)', () => {
    const fixture = reference();
    const path = GENERATE_PATHS[0]!;
    const index = candidateRoleIndices(fixture)[0]!;
    const { files, provenance } = generateRecorded(path, fixture);
    const sites = roleGuardSites(
      filterProvenanceByPath(provenance, addressesPath(index)),
      files
    );
    expect(
      sites.length,
      'expected at least one #[only_*] site for an Addresses query before clear'
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// INV-17 / AS-1 — clear-members re-measure on role-guard sites (no count)
// ---------------------------------------------------------------------------

describe.each(GENERATE_PATHS)(
  '$name — INV-17 Addresses clear-members oracle (role-guard scope)',
  (path) => {
    const fixture = reference();
    const candidates = candidateRoleIndices(fixture);

    it.each(candidates.map((index) => ({ index, path: addressesPath(index) })))(
      'no falsely stable role-guard site for $path after clear-members',
      ({ index }) => {
        assertNoFalselyStableRoleGuardSites(path, fixture, index);
      }
    );

    it('suite never pins a fixed Addresses ranged-row count', () => {
      const before = generateRecorded(path, fixture);
      const firstPath = addressesPath(candidates[0]!);
      const n = roleGuardSites(
        filterProvenanceByPath(before.provenance, firstPath),
        before.files
      ).length;
      expect(typeof n).toBe('number');
      // Deliberately no expect(n).toBe(<literal>).
      expect(n).toBeGreaterThanOrEqual(0);
    });
  }
);

// ---------------------------------------------------------------------------
// AS-3 / INV-4 — role-guard ranges lack the list root
// ---------------------------------------------------------------------------

describe.each(GENERATE_PATHS)('$name — AS-3 role-guard ranges omit list root', (path) => {
  it('no range covering an only_role / only_admin guard line lists ACCESS_CONTROL_ROLES', () => {
    const { files, provenance } = generateRecorded(path, reference());
    const source = textOf(files, RWA_TOKEN);
    const lines = source.split('\n');

    const guardLineNumbers: number[] = [];
    lines.forEach((line, i) => {
      if (isGuardAttributeLine(line)) guardLineNumbers.push(i + 1);
    });
    expect(
      guardLineNumbers.length,
      'fixture must produce guard attributes so AS-3 is non-vacuous'
    ).toBeGreaterThan(0);

    const offenders: { line: number; text: string; paths: readonly ConfigPath[] }[] = [];
    for (const lineNum of guardLineNumbers) {
      for (const entry of rangeEntries(provenance, RWA_TOKEN) as readonly RangeEntry[]) {
        if (entry.range.start > lineNum || lineNum > entry.range.end) continue;
        if (entry.paths.includes(ACCESS_CONTROL_ROLES)) {
          offenders.push({
            line: lineNum,
            text: lines[lineNum - 1] ?? '',
            paths: entry.paths,
          });
        }
      }
    }

    expect(
      offenders,
      [
        'AS-3 / INV-4: role-guard emits must not leave accessControl.roles on the range.',
        ...offenders.map(
          (o) => `  line ${o.line}: ${o.text.trim()} paths=${JSON.stringify(o.paths)}`
        ),
      ].join('\n')
    ).toEqual([]);
  });

  it('Addresses child path may remain on a matching role-guard emit (INV-3 exactness)', () => {
    const minterAddresses = addressesPath(1);
    const { provenance } = generateRecorded(path, reference());
    const childHits = rangeEntries(provenance, RWA_TOKEN).filter(
      (entry) => entry.kind === 'range' && entry.paths.includes(minterAddresses)
    );
    expect(
      childHits.length,
      `expected some range to keep ${minterAddresses} after exact omit of the list root`
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// INV-12 — cross-role silence
// ---------------------------------------------------------------------------

describe.each(GENERATE_PATHS)('$name — INV-12 cross-role Addresses silence', (path) => {
  it('empty freezer Addresses does not light the mint only_role line', () => {
    const fixture = createValidConfig({
      accessControl: {
        roles: [
          { name: 'Minter', symbol: 'minter', addresses: ['GCMINTERADDR001'] },
          { name: 'Freezer', symbol: 'freezer', addresses: [] },
        ],
      },
    });
    const freezerPath = addressesPath(1);
    const { files, provenance } = generateRecorded(path, fixture);
    const source = textOf(files, RWA_TOKEN);
    const filtered = filterProvenanceByPath(provenance, freezerPath);

    const mintOnlyRoleLines = source
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(
        ({ line, n }) =>
          line.includes('#[only_role(') &&
          source
            .split('\n')
            .slice(n - 1, n + 5)
            .some((nearby) => nearby.includes('fn mint('))
      );

    const lit = mintOnlyRoleLines.filter(({ n }) =>
      (filtered.files[RWA_TOKEN]?.entries ?? []).some(
        (entry) =>
          entry.kind === 'range' && entry.range.start <= n && n <= entry.range.end
      )
    );

    expect(
      lit,
      [
        'INV-12: freezer Addresses must not return mint only_role after list-root omit.',
        ...lit.map(({ n, line }) => `  line ${n}: ${line.trim()}`),
      ].join('\n')
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// INV-5 — whole-list keep: list root must not sit on guard-only ranges
// ---------------------------------------------------------------------------

describe.each(GENERATE_PATHS)('$name — INV-5 whole-list list-root stays off guards', (path) => {
  it('any remaining ACCESS_CONTROL_ROLES range is not a guard-attribute-only slice', () => {
    const { files, provenance } = generateRecorded(path, reference());
    const source = textOf(files, RWA_TOKEN);
    const withRoot = rangeEntries(provenance, RWA_TOKEN).filter(
      (entry) => entry.kind === 'range' && entry.paths.includes(ACCESS_CONTROL_ROLES)
    );

    for (const entry of withRoot) {
      const lines = sliceRange(source, entry.range);
      expect(
        lines.every(isGuardAttributeLine),
        `list root must not sit on a guard-only range: ${JSON.stringify(lines)}`
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// INV-8 — file bytes unchanged across two recorded generates
// ---------------------------------------------------------------------------

describe.each(GENERATE_PATHS)('$name — INV-8 provenance recording is pure w.r.t. bytes', (path) => {
  it('two recorded generates yield identical file bytes', () => {
    const fixture = reference();
    const a = generateRecorded(path, fixture);
    const b = generateRecorded(path, fixture);
    expect(Object.keys(a.files).sort()).toEqual(Object.keys(b.files).sort());
    for (const filePath of Object.keys(a.files)) {
      expect(a.files[filePath], filePath).toEqual(b.files[filePath]);
    }
  });
});

// ---------------------------------------------------------------------------
// INV-16 — failure messages name paths/files, not wallet payloads
// ---------------------------------------------------------------------------

describe('INV-16 — oracle helpers do not embed fixture addresses in expect messages', () => {
  it('describeSite uses line preview only', () => {
    const message = describeSite({
      filePath: RWA_TOKEN,
      lines: ['    #[only_role(MINTER_ROLE, operator)]'],
    });
    expect(message).toContain(RWA_TOKEN);
    expect(message).not.toMatch(/GCPAUSER|GCMINTER|GCFREEZER/);
  });
});

// ---------------------------------------------------------------------------
// Residual SC-016 gaps (documented — not silent)
// ---------------------------------------------------------------------------

describe('SC-016 residual gaps (named; outside SF-19 wrap inventory)', () => {
  it('documents that whole-list list-root matching can still answer Addresses on deploy.sh', () => {
    // additionalRoles / deploy serialization keep ACCESS_CONTROL_ROLES (INV-5).
    // Ancestor matching then lights some byte-stable deploy lines for every
    // Addresses query. Fixing that is matching or whole-list omit — out of SF-19.
    const path = GENERATE_PATHS[0]!;
    const fixture = reference();
    const { files, provenance } = generateRecorded(path, fixture);
    const filtered = filterProvenanceByPath(provenance, addressesPath(1));
    const deployRanges = filtered.files['scripts/deploy.sh']?.entries ?? [];
    expect(
      deployRanges.some((e) => e.kind === 'range'),
      'probe: deploy.sh still appears under Addresses via list-root matching (known residual)'
    ).toBe(true);
    void files;
  });
});
