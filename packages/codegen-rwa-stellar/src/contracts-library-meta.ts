import { GENERATED_STELLAR_SOURCE_REPO_URL } from './upstream/generated-revision';

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
