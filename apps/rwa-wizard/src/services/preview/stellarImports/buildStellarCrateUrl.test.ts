import { describe, expect, it } from 'vitest';

import { FIXTURE_REV_A, STELLAR_REPO_URL } from '../../../test/helpers/stellarImportFixtures';
import type { StructuralUpstreamSourceRevision } from '../../../types/wizard';
import { buildStellarCrateUrl } from './buildStellarCrateUrl';

function revision(
  partial: Partial<StructuralUpstreamSourceRevision> &
    Pick<StructuralUpstreamSourceRevision, 'repoUrl'>
): StructuralUpstreamSourceRevision {
  return {
    commitHash: null,
    mode: 'local-path',
    ...partial,
  };
}

describe('buildStellarCrateUrl request/response (INV-2, INV-3, INV-5, INV-6)', () => {
  it('pins href to the revision object commitHash verbatim (INV-2, INV-6)', () => {
    const rev = revision({
      repoUrl: STELLAR_REPO_URL,
      commitHash: FIXTURE_REV_A,
      mode: 'git-revision',
    });
    expect(
      buildStellarCrateUrl(rev, 'stellar_access'),
      'INV-2: tree segment must use the same commitHash as the revision snapshot'
    ).toBe(`${STELLAR_REPO_URL}/tree/${FIXTURE_REV_A}/packages/access`);
  });

  it('returns repo root only when commitHash is null (INV-3)', () => {
    const rev = revision({ repoUrl: STELLAR_REPO_URL });
    expect(
      buildStellarCrateUrl(rev, 'stellar_tokens'),
      'INV-3: null commitHash must not emit /tree/{ref}/'
    ).toBe(STELLAR_REPO_URL);
    expect(buildStellarCrateUrl(rev, 'stellar_tokens')).not.toMatch(/\/tree\//);
  });

  it('returns null for unmapped crate identifiers (INV-5)', () => {
    const rev = revision({
      repoUrl: STELLAR_REPO_URL,
      commitHash: FIXTURE_REV_A,
      mode: 'git-revision',
    });
    expect(buildStellarCrateUrl(rev, 'soroban_sdk')).toBeNull();
    expect(buildStellarCrateUrl(rev, 'rwa_token')).toBeNull();
  });

  it('builds a tree URL for each mapped crate at a fixture hash (INV-6)', () => {
    const rev = revision({
      repoUrl: STELLAR_REPO_URL,
      commitHash: FIXTURE_REV_A,
      mode: 'git-revision',
    });
    expect(buildStellarCrateUrl(rev, 'stellar_macros')).toBe(
      `${STELLAR_REPO_URL}/tree/${FIXTURE_REV_A}/packages/macros`
    );
    expect(buildStellarCrateUrl(rev, 'stellar_contract_utils')).toBe(
      `${STELLAR_REPO_URL}/tree/${FIXTURE_REV_A}/packages/contract-utils`
    );
  });
});
