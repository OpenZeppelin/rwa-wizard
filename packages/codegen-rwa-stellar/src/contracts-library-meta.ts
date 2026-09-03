import type { GenerateOptions } from '@openzeppelin/codegen-core';

import {
  GENERATED_STELLAR_SOURCE_COMMIT_HASH,
  GENERATED_STELLAR_SOURCE_REPO_URL,
} from './upstream/generated-revision';

/**
 * Raw git URL recorded when stellar templates were last synced from upstream.
 * Re-exported for tooling that needs the exact remote reference.
 */
export { GENERATED_STELLAR_SOURCE_REPO_URL };

/**
 * HTTPS URL for the upstream contracts library in the browser (trailing `.git`
 * stripped). Matches the repository revision bundled into this package via
 * `scripts/sync-stellar-templates.mjs` — the same source used for codegen.
 */
export function getContractsLibraryRepositoryUrl(): string {
  return GENERATED_STELLAR_SOURCE_REPO_URL.replace(/\.git$/, '');
}

/** How the generated workspace manifest resolves upstream contract crates. */
export type UpstreamDependencyMode = 'git-revision' | 'local-path';

/**
 * Upstream coordinates of the library code the generator emits `use` statements
 * against. Structural metadata only — no prose, no rendering decisions.
 */
export interface UpstreamSourceRevision {
  /** Browser URL, trailing `.git` stripped. */
  readonly repoUrl: string;
  /**
   * Commit the emitted crates are pinned to, or `null` in `local-path` mode
   * where the manifest points at a working copy and pins nothing.
   */
  readonly commitHash: string | null;
  readonly mode: UpstreamDependencyMode;
}

/**
 * Report the upstream source coordinates for a generation, so consumers can
 * link generated `use stellar_*` paths at the exact revision that produced them
 * without reading the generated files back.
 *
 * Mirrors `generateWorkspaceToml` — `contractsLibraryPath` switches the manifest
 * to path dependencies, which pin no revision, so `commitHash` is `null` there.
 * Pass the same options you pass to `generate`.
 */
export function getUpstreamSourceRevision(options?: GenerateOptions): UpstreamSourceRevision {
  const repoUrl = getContractsLibraryRepositoryUrl();

  if (options?.contractsLibraryPath) {
    return { repoUrl, commitHash: null, mode: 'local-path' };
  }

  return {
    repoUrl,
    commitHash: GENERATED_STELLAR_SOURCE_COMMIT_HASH,
    mode: 'git-revision',
  };
}
