/**
 * Shape-B proofs: the contract sources produced by exact patches over upstream.
 *
 * The important finding this suite encodes: of the five core contracts, only
 * `rwa-token` reads config. `compliance`, `identity-verifier`,
 * `claim-topics-issuers` and `identity-registry-storage` return upstream text
 * with unconditional (config-free) patches, so their honest answer is empty
 * paths — asserting a field site on them would be a bug in the test, not a gap
 * in the migration (INV-36).
 */
import { describe, expect, it } from 'vitest';

import { createValidConfig } from '../helpers/config';

import {
  GENERATE_PATHS,
  entriesOf,
  generateRecorded,
  rangesForPath,
  sliceRange,
  textOf,
} from './helpers';

const RWA_TOKEN = 'contracts/rwa-token/src/contract.rs';

const CONFIG_FREE_CONTRACTS = [
  'contracts/compliance/src/contract.rs',
  'contracts/identity-verifier/src/contract.rs',
  'contracts/claim-topics-issuers/src/contract.rs',
  'contracts/identity-registry-storage/src/contract.rs',
] as const;

describe.each(GENERATE_PATHS)('$name — config-free core contracts', (path) => {
  it.each(CONFIG_FREE_CONTRACTS)('records %s with empty paths and no range', (contract) => {
    const { provenance } = generateRecorded(path, createValidConfig());

    expect(entriesOf(provenance, contract)).toEqual([{ kind: 'file', paths: [] }]);
  });
});

describe.each(GENERATE_PATHS)('$name — rwa-token contract attribution', (path) => {
  const configWithRoles = createValidConfig({
    token: { decimals: 11, documentManager: { enabled: true } },
    accessControl: {
      roles: [
        { name: 'Manager', symbol: 'manager', addresses: ['GCEXAMPLEMGR'] },
        { name: 'Minter', symbol: 'minter', addresses: ['GCEXAMPLEMINT'] },
      ],
    },
  });

  // INV-33: the decimals range must hold the decimals value.
  it('points token.decimals at the metadata line that carries it', () => {
    const { files, provenance } = generateRecorded(path, configWithRoles);
    const source = textOf(files, RWA_TOKEN);

    const ranges = rangesForPath(provenance, RWA_TOKEN, 'token.decimals');
    expect(ranges.length).toBeGreaterThan(0);

    const attributed = ranges.flatMap((range) => sliceRange(source, range));
    expect(attributed.some((line) => line.includes('Base::set_metadata(e, 11, name, symbol)'))).toBe(
      true
    );
  });

  // INV-34 / INV-35: decimals must not have swallowed the role wiring.
  it('keeps the decimals range clear of role wiring and imports', () => {
    const { files, provenance } = generateRecorded(path, configWithRoles);
    const source = textOf(files, RWA_TOKEN);

    const attributed = rangesForPath(provenance, RWA_TOKEN, 'token.decimals').flatMap((range) =>
      sliceRange(source, range)
    );

    expect(attributed.some((line) => line.includes('MINTER_ROLE'))).toBe(false);
    expect(attributed.some((line) => line.includes('grant_role_members'))).toBe(false);
    expect(attributed.some((line) => line.startsWith('use '))).toBe(false);
    expect(attributed.every((line) => line.trim() !== '')).toBe(true);
  });

  // INV-33: the configured role's symbol must appear on lines attributed to it.
  it('points the configured role at the lines that wire it', () => {
    const { files, provenance } = generateRecorded(path, configWithRoles);
    const source = textOf(files, RWA_TOKEN);

    const ranges = rangesForPath(provenance, RWA_TOKEN, 'accessControl.roles[1].symbol');
    expect(ranges.length).toBeGreaterThan(0);

    const attributed = ranges.flatMap((range) => sliceRange(source, range));
    expect(attributed.some((line) => line.toLowerCase().includes('minter'))).toBe(true);
  });

  // INV-34: an unrelated sibling field matches nothing on this file.
  it('does not attribute an unrelated sibling field to the contract', () => {
    const { provenance } = generateRecorded(path, configWithRoles);

    const claimed = entriesOf(provenance, RWA_TOKEN).flatMap((entry) => entry.paths);
    expect(claimed).not.toContain('deployment.target.networkId');
    expect(claimed.some((p) => p.startsWith('identityVerification.trustedIssuers'))).toBe(false);
  });

  // INV-33: the document-manager toggle shapes the block it switches on.
  it('points the document-manager toggle at the DocumentManager impl', () => {
    const { files, provenance } = generateRecorded(path, configWithRoles);
    const source = textOf(files, RWA_TOKEN);

    const ranges = rangesForPath(provenance, RWA_TOKEN, 'token.documentManager.enabled');
    expect(ranges.length).toBeGreaterThan(0);

    const attributed = ranges.flatMap((range) => sliceRange(source, range));
    expect(attributed.some((line) => line.includes('DocumentManager'))).toBe(true);
  });

  it('records no document-manager range when the extension is off', () => {
    const { provenance } = generateRecorded(
      path,
      createValidConfig({ token: { documentManager: { enabled: false } } })
    );

    expect(rangesForPath(provenance, RWA_TOKEN, 'token.documentManager.enabled')).toEqual([]);
  });

  /**
   * INV-22 (SF-3) + SF-19 hazard-5 omit. With no role configured, the guard
   * attribute equals the upstream one, so `replaceExact(search, search)` moves
   * no byte — the edit is still issued (goldens / file text prove that). After
   * SF-19, the observe walked an empty roles list and left only the list root;
   * `withoutRolesListRoot` drops that root, empty paths skip `addRange`, and
   * `accessControl.roles` no longer lights those byte-identical `#[only_admin]`
   * lines (US-6 / AS-3). Pre-SF-19 this test asserted the opposite.
   */
  it('keeps byte-identical only_admin guards in the file without attributing the list root', () => {
    const noRoles = createValidConfig({ accessControl: { roles: [] } });
    const { files, provenance } = generateRecorded(path, noRoles);
    const source = textOf(files, RWA_TOKEN);

    expect(source.split('\n').filter((line) => line === '    #[only_admin]').length).toBeGreaterThan(
      1
    );

    const attributed = rangesForPath(provenance, RWA_TOKEN, 'accessControl.roles').flatMap((range) =>
      sliceRange(source, range)
    );
    expect(attributed.filter((line) => line === '    #[only_admin]')).toEqual([]);
  });

  /**
   * INV-35, stated as SF-2's trimming rule actually guarantees it: a range never
   * BEGINS or ENDS on a blank line. Blank lines inside a multi-line block are
   * legitimate — the DocumentManager impl contains them — but a range whose
   * boundary is blank is pointing at a line the field did not shape.
   */
  it('starts and ends every range on a line with content', () => {
    const { files, provenance } = generateRecorded(path, configWithRoles);
    const source = textOf(files, RWA_TOKEN);
    const lines = source.split('\n');

    const offenders = rangesForPath(provenance, RWA_TOKEN, 'token.decimals')
      .concat(rangesForPath(provenance, RWA_TOKEN, 'accessControl.roles'))
      .filter(
        (range) =>
          (lines[range.start - 1] ?? '').trim() === '' || (lines[range.end - 1] ?? '').trim() === ''
      );

    expect(offenders).toEqual([]);
  });
});
