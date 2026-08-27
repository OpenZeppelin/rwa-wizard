import { STELLAR_CRATE_REPO_PATHS } from './stellarCratePaths';
import type { StellarSourceRevision } from './types';

/**
 * Build a GitHub tree URL for a mapped crate at a pinned revision.
 * When `commitHash` is null, returns `repoUrl` only (repo root, INV-3).
 */
export function buildStellarCrateUrl(
  revision: StellarSourceRevision,
  crateId: string
): string | null {
  const repoPath = STELLAR_CRATE_REPO_PATHS[crateId];
  if (!repoPath) {
    return null; // INV-5
  }

  if (revision.commitHash === null) {
    return revision.repoUrl; // INV-3: no /tree/{ref}/ segment
  }

  return `${revision.repoUrl}/tree/${revision.commitHash}/${repoPath}`; // INV-2, INV-6
}
