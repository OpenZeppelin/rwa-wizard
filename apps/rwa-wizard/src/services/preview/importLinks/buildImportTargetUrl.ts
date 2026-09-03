import type {
  StructuralUpstreamImportTarget,
  StructuralUpstreamSourceRevision,
} from '../../../types/wizard';

/**
 * Build a GitHub tree URL for an import target at a pinned revision.
 * When `commitHash` is null, returns `repoUrl` only (repo root, INV-3).
 */
export function buildImportTargetUrl(
  revision: StructuralUpstreamSourceRevision,
  target: StructuralUpstreamImportTarget
): string {
  if (revision.commitHash === null) {
    return revision.repoUrl; // INV-3: no /tree/{ref}/ segment
  }

  return `${revision.repoUrl}/tree/${revision.commitHash}/${target.path}`; // INV-2, INV-6
}
