/**
 * Shape-C proofs: the split literals and the static files.
 *
 * Two separate things are checked here, because they fail differently:
 * the SPLIT must preserve bytes for inputs the fixture matrix never reaches
 * (INV-6, INV-38), and the ATTRIBUTION must name only lines the field shaped
 * (INV-33, INV-34, INV-35). A static file's proof is that it records emptiness
 * explicitly rather than being absent (INV-36).
 */
import { describe, expect, it } from 'vitest';

import {
  generateWorkspaceToml,
  workspaceTomlBlocks,
} from '../../src/templates/cargo/workspace-toml';
import type { WorkspaceTomlConfig } from '../../src/templates/cargo/workspace-toml';

import { createValidConfig } from '../helpers/config';

import {
  GENERATE_PATHS,
  GOLDEN_FIXTURES,
  entriesOf,
  fileEntry,
  generateRecorded,
  noModuleConfig,
  rangeEntries,
  rangesForPath,
  sliceRange,
  textOf,
  twoModuleConfig,
} from './helpers';

/* ================================================================== *
 * INV-6 / INV-38: the split reproduces the literal for EVERY input,
 * not merely for the 16 fixtures.
 * ================================================================== */

describe('workspace Cargo.toml — split join identity', () => {
  const MEMBERS = ['contracts/rwa-token', 'contracts/compliance'];

  /**
   * The boundary inputs the golden matrix demonstrably does not reach. Each row
   * varies exactly one interpolation the split touches.
   */
  const BOUNDARY_INPUTS: readonly (readonly [string, WorkspaceTomlConfig])[] = [
    ['empty members', { members: [] }],
    ['one member', { members: ['contracts/only'] }],
    ['many members', { members: MEMBERS }],
    ['empty exclude', { members: MEMBERS, exclude: [] }],
    ['one exclude', { members: MEMBERS, exclude: ['tools/sign-claim'] }],
    ['many excludes', { members: MEMBERS, exclude: ['tools/a', 'tools/b'] }],
    ['empty extra deps', { members: MEMBERS, extraWorkspaceDependencies: {} }],
    ['one extra dep', { members: MEMBERS, extraWorkspaceDependencies: { 'ed25519-dalek': '"2"' } }],
    ['local checkout', { members: MEMBERS, contractsLibraryPath: '/tmp/checkout/' }],
    ['custom repository url', { members: MEMBERS, repositoryUrl: 'https://example.test/x.git' }],
    [
      'every option at once',
      {
        members: [],
        exclude: ['tools/sign-claim'],
        extraWorkspaceDependencies: { 'ed25519-dalek': '"2.1.1"' },
        contractsLibraryPath: '/tmp/checkout',
        repositoryUrl: 'https://example.test/y.git',
      },
    ],
  ];

  it.each(BOUNDARY_INPUTS)('blocks join back to the manifest: %s', (_label, config) => {
    const joined = workspaceTomlBlocks(config)
      .map((block) => block.text)
      .join('\n');

    expect(joined).toBe(generateWorkspaceToml(config));
  });

  /**
   * The grouped form is what the composition roots emit. Splitting the member
   * list into groups must not move a byte — including when a group is empty,
   * which is the case the 16 fixtures with modules never exercise.
   */
  it.each([
    ['no modules', [] as string[]],
    ['one module', ['contracts/modules/a']],
    ['two modules', ['contracts/modules/a', 'contracts/modules/b']],
  ])('grouped members join back to the ungrouped manifest: %s', (_label, moduleMembers) => {
    const core = ['contracts/rwa-token', 'contracts/compliance'];
    const support = ['contracts/identity-support'];
    const flat = [...core, ...moduleMembers, ...support];

    const grouped = workspaceTomlBlocks({ members: flat }, [
      { members: core, paths: [] },
      { members: moduleMembers, paths: ['compliance.modules[0].moduleId'] },
      { members: support, paths: [] },
    ])
      .map((block) => block.text)
      .join('\n');

    expect(grouped).toBe(generateWorkspaceToml({ members: flat }));
  });

  it('emits an empty element for an empty member list, reproducing the blank line', () => {
    const blocks = workspaceTomlBlocks({ members: [] });

    expect(blocks.map((block) => block.text)).toContain('');
    expect(generateWorkspaceToml({ members: [] })).toContain('members = [\n\n]');
  });

  it('never attributes a block outside the member groups', () => {
    const blocks = workspaceTomlBlocks({ members: ['contracts/a'] }, [
      { members: ['contracts/a'], paths: ['compliance.modules[0].moduleId'] },
    ]);

    const attributed = blocks.filter((block) => block.paths.length > 0);
    expect(attributed).toHaveLength(1);
    expect(attributed[0]?.text).toBe('    "contracts/a",');
  });
});

/* ================================================================== *
 * INV-33 / INV-34 / INV-35: what the member range actually points at.
 * ================================================================== */

describe.each(GENERATE_PATHS)('$name — root Cargo.toml attribution', (path) => {
  it('points the module member range at module member lines only', () => {
    const config = twoModuleConfig();
    const { files, provenance } = generateRecorded(path, config);
    const manifest = textOf(files, 'Cargo.toml');

    const ranges = rangesForPath(provenance, 'Cargo.toml', 'compliance.modules[0].moduleId');
    expect(ranges.length).toBeGreaterThan(0);

    const attributed = ranges.flatMap((range) => sliceRange(manifest, range));

    // INV-33: every attributed line is a module member line.
    for (const line of attributed) {
      expect(line).toMatch(/^ {4}"contracts\/modules\/[^"]+",$/);
    }
    // INV-35 / INV-34: the fixed core members are NOT inside the range.
    expect(attributed).not.toContain('    "contracts/rwa-token",');
    expect(attributed).not.toContain('    "contracts/compliance",');
    expect(attributed.some((line) => line.includes('[workspace.package]'))).toBe(false);
  });

  it('records no member range at all when no module is selected', () => {
    const { provenance } = generateRecorded(path, noModuleConfig());

    expect(rangeEntries(provenance, 'Cargo.toml')).toEqual([]);
  });

  // INV-34: the second module's index must not ride the first module's entry
  // alone — each occurrence path is present, and neither invents the other.
  it('carries one path per selected module occurrence', () => {
    const { provenance } = generateRecorded(path, twoModuleConfig());

    const paths = fileEntry(provenance, 'Cargo.toml').paths;
    expect(paths).toContain('compliance.modules[0].moduleId');
    expect(paths).toContain('compliance.modules[1].moduleId');
    expect(paths).not.toContain('compliance.modules[2].moduleId');
    expect(paths.some((p) => p.startsWith('token.'))).toBe(false);
  });
});

/* ================================================================== *
 * INV-36: static files record emptiness, explicitly.
 * ================================================================== */

const STATIC_PATH_PATTERNS: readonly RegExp[] = [
  /^scripts\/build\.sh$/,
  /^rustfmt\.toml$/,
  /^contracts\/[^/]+\/src\/lib\.rs$/,
  /^contracts\/modules\/[^/]+\/src\/lib\.rs$/,
  /^contracts\/[^/]+\/Cargo\.toml$/,
  /^contracts\/modules\/[^/]+\/Cargo\.toml$/,
];

const isStaticPath = (filePath: string): boolean =>
  STATIC_PATH_PATTERNS.some((pattern) => pattern.test(filePath));

describe.each(GENERATE_PATHS)('$name — static files', (path) => {
  const fixture = GOLDEN_FIXTURES.find((f) => f.name === 'compliance-all-modules');
  if (fixture === undefined) throw new Error('missing the compliance-all-modules fixture');

  it('records exactly one empty file entry and no ranges for every static file', () => {
    const { files, provenance } = generateRecorded(path, fixture.config);

    const staticPaths = Object.keys(files).filter(isStaticPath);
    expect(staticPaths.length).toBeGreaterThan(0);

    // INV-36: one `file` entry with empty paths and NO range. A `created` entry
    // is permitted, and only where existence really is config-conditional —
    // the per-module crates, never the fixed core ones.
    const offenders = staticPaths
      .map((filePath) => ({ filePath, entries: entriesOf(provenance, filePath) }))
      .filter(({ filePath, entries }) => {
        const file = entries.find((entry) => entry.kind === 'file');
        const created = entries.find((entry) => entry.kind === 'created');
        const isModuleFile = filePath.startsWith('contracts/modules/');
        return (
          file === undefined ||
          file.paths.length !== 0 ||
          entries.some((entry) => entry.kind === 'range') ||
          (created !== undefined && !isModuleFile) ||
          (isModuleFile && created === undefined)
        );
      });

    expect(offenders).toEqual([]);
  });

  // INV-36, stated as the design states it: asserting a field site on build.sh
  // is a bug in the test, not a gap in the migration.
  it('leaves scripts/build.sh matching no config dimension at all', () => {
    const { provenance } = generateRecorded(path, fixture.config);

    expect(entriesOf(provenance, 'scripts/build.sh')).toEqual([{ kind: 'file', paths: [] }]);
  });
});

/* ================================================================== *
 * README.md — the other shape-C split (INV-6, INV-33, INV-34, INV-37)
 * ================================================================== */

describe.each(GENERATE_PATHS)('$name — README.md attribution', (path) => {
  const README = 'README.md';

  // INV-33: the title line holds the name and symbol it is attributed to.
  it('isolates the title line for the token name and symbol', () => {
    const config = createValidConfig({ token: { name: 'Acme Real Estate Token', symbol: 'ACME' } });
    const { files, provenance } = generateRecorded(path, config);
    const readme = textOf(files, README);

    for (const field of ['token.name', 'token.symbol']) {
      const ranges = rangesForPath(provenance, README, field);
      expect(ranges.length).toBeGreaterThan(0);
      const attributed = ranges.flatMap((range) => sliceRange(readme, range));
      expect(attributed).toContain('# Acme Real Estate Token (ACME)');
      // INV-34: the title must not have swallowed the generated-by line below it.
      expect(attributed.some((line) => line.startsWith('> Generated by'))).toBe(false);
    }
  });

  // INV-33: the contract table is its own block, and holds the table.
  it('isolates the contract table', () => {
    const { files, provenance } = generateRecorded(path, createValidConfig());
    const readme = textOf(files, README);

    const tableRanges = rangeEntries(provenance, README).filter((entry) =>
      sliceRange(readme, entry.range).some((line) => line.includes('| Contract |'))
    );
    expect(tableRanges.length).toBeGreaterThan(0);

    for (const entry of tableRanges) {
      // INV-34: the table block must not reach into the Architecture prose.
      expect(
        sliceRange(readme, entry.range).some((line) => line.startsWith('## Architecture'))
      ).toBe(false);
    }
  });

  /**
   * INV-37: `renderSelectedModules` returns `''` when nothing is selected. Its
   * span shares a line with `### Upstream Provenance`, so it cannot be its own
   * block; the merged block must not then claim a heading as a module's impact
   * when no module is selected.
   */
  it('records no module range on the merged provenance block when nothing is selected', () => {
    const { files, provenance } = generateRecorded(path, noModuleConfig());
    const readme = textOf(files, README);

    const moduleRanges = rangeEntries(provenance, README).filter((entry) =>
      entry.paths.some((p) => p.startsWith('compliance.modules['))
    );

    for (const entry of moduleRanges) {
      const body = sliceRange(readme, entry.range);
      expect(body.every((line) => line.trim() === '')).toBe(false);
    }
  });

  // INV-35: no range begins or ends on a blank line.
  it('starts and ends every range on a line with content', () => {
    const { files, provenance } = generateRecorded(path, twoModuleConfig());
    const readme = textOf(files, README);
    const lines = readme.split('\n');

    const offenders = rangeEntries(provenance, README).filter(
      (entry) =>
        (lines[entry.range.start - 1] ?? '').trim() === '' ||
        (lines[entry.range.end - 1] ?? '').trim() === ''
    );

    expect(offenders).toEqual([]);
  });
});
