import { describe, expect, it } from 'vitest';

import { getUpstreamSourceRevision } from '../src/contracts-library-meta';
import { generateWorkspaceToml } from '../src/templates/cargo/workspace-toml';

const MEMBERS = ['contracts/rwa-token'];

/**
 * `getUpstreamSourceRevision` exists so consumers can link generated `use`
 * paths at the revision that produced them without parsing the manifest. That
 * only holds while the two agree, so each case asserts the reported coordinates
 * against the manifest the same options actually generate.
 */
describe('getUpstreamSourceRevision', () => {
  it('reports the pinned git revision the default manifest emits', () => {
    const revision = getUpstreamSourceRevision();
    const manifest = generateWorkspaceToml({ members: MEMBERS });

    expect(revision.mode).toBe('git-revision');
    expect(revision.commitHash).not.toBeNull();
    expect(manifest).toContain(`rev = "${revision.commitHash!}"`);
    expect(manifest).toContain(`git = "${revision.repoUrl}.git"`);
  });

  it('reports no pinned commit when options select a local checkout', () => {
    const contractsLibraryPath = '../stellar-contracts';
    const revision = getUpstreamSourceRevision({ contractsLibraryPath });
    const manifest = generateWorkspaceToml({ members: MEMBERS, contractsLibraryPath });

    expect(revision.mode).toBe('local-path');
    expect(revision.commitHash).toBeNull();
    expect(manifest).not.toContain('rev = ');
    expect(manifest).toContain(`path = "${contractsLibraryPath}/packages/`);
  });

  it('strips the .git suffix so the URL is browsable', () => {
    expect(getUpstreamSourceRevision().repoUrl).not.toMatch(/\.git$/);
  });
});
