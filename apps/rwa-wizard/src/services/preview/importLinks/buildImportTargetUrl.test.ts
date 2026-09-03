import { describe, expect, it } from 'vitest';

import { FIXTURE_REV_A, STELLAR_REPO_URL } from '../../../test/helpers/importLinkFixtures';
import type {
  StructuralUpstreamImportTarget,
  StructuralUpstreamSourceRevision,
} from '../../../types/wizard';
import { buildImportTargetUrl } from './buildImportTargetUrl';

const ACCESS: StructuralUpstreamImportTarget = {
  identifier: 'pkg_access',
  path: 'packages/access',
};
const TOKENS: StructuralUpstreamImportTarget = {
  identifier: 'pkg_tokens',
  path: 'packages/tokens',
};

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

describe('buildImportTargetUrl request/response (INV-2, INV-3, INV-5, INV-6)', () => {
  it('pins href to the revision object commitHash verbatim (INV-2, INV-6)', () => {
    const rev = revision({
      repoUrl: STELLAR_REPO_URL,
      commitHash: FIXTURE_REV_A,
      mode: 'git-revision',
    });

    expect(
      buildImportTargetUrl(rev, ACCESS),
      'INV-2: tree segment must use the same commitHash as the revision snapshot'
    ).toBe(`${STELLAR_REPO_URL}/tree/${FIXTURE_REV_A}/packages/access`);
  });

  it('returns repo root only when commitHash is null (INV-3)', () => {
    const rev = revision({ repoUrl: STELLAR_REPO_URL });

    expect(
      buildImportTargetUrl(rev, TOKENS),
      'INV-3: null commitHash must not emit /tree/{ref}/'
    ).toBe(STELLAR_REPO_URL);
    expect(buildImportTargetUrl(rev, TOKENS)).not.toMatch(/\/tree\//);
  });

  it('uses the path the package reported, whatever it is (INV-5, INV-6)', () => {
    const rev = revision({
      repoUrl: 'https://github.com/example/other-library',
      commitHash: FIXTURE_REV_A,
      mode: 'git-revision',
    });

    expect(
      buildImportTargetUrl(rev, { identifier: 'anything', path: 'src/modules/thing' }),
      'the wizard maps no identifier of its own to a directory'
    ).toBe(`https://github.com/example/other-library/tree/${FIXTURE_REV_A}/src/modules/thing`);
  });
});
