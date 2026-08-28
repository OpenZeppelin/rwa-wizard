import { getAvailableModules } from './modules/registry';
import { IDENTITY_SUPPORT_CONTRACTS } from './templates/identity-support-contracts';

import { CRATE_NAMES } from './constants';

export const GENERATED_FILE_KINDS = [
  'contract',
  'script',
  'provenance-and-docs',
  'unknown',
] as const;

export type GeneratedFileKind = (typeof GENERATED_FILE_KINDS)[number];

type RankedGeneratedFileKind = Exclude<GeneratedFileKind, 'unknown'>;

/** Source files `generateContractCrateFiles` writes for one crate directory. */
function contractCrateSourcePaths(dirPath: string): readonly [string, string] {
  return [`${dirPath}/src/contract.rs`, `${dirPath}/src/lib.rs`];
}

function addContractCrate(catalog: Map<string, RankedGeneratedFileKind>, dirPath: string): void {
  for (const path of contractCrateSourcePaths(dirPath)) {
    catalog.set(path, 'contract');
  }
}

/**
 * Enumerate ranking paths from the same constants the generator uses to emit
 * them. Lookup miss is `unknown`; there is no suffix or directory fallback.
 */
function buildGeneratedFileKindCatalog(): ReadonlyMap<string, RankedGeneratedFileKind> {
  const catalog = new Map<string, RankedGeneratedFileKind>();

  for (const crateName of Object.values(CRATE_NAMES)) {
    addContractCrate(catalog, `contracts/${crateName}`);
  }

  for (const entry of getAvailableModules()) {
    addContractCrate(catalog, `contracts/modules/${entry.crateName}`);
  }

  for (const contract of IDENTITY_SUPPORT_CONTRACTS) {
    addContractCrate(catalog, contract.dirPath);
  }

  catalog.set('scripts/build.sh', 'script');
  catalog.set('scripts/deploy.sh', 'script');
  catalog.set('scripts/bootstrap-demo-mint.sh', 'script');
  catalog.set('config.json', 'provenance-and-docs');
  catalog.set('README.md', 'provenance-and-docs');
  catalog.set('UNDER_REVIEW_MODULES.md', 'provenance-and-docs');

  return catalog;
}

const GENERATED_FILE_KIND_CATALOG: ReadonlyMap<string, RankedGeneratedFileKind> =
  buildGeneratedFileKindCatalog();

/**
 * Ranking kind for one generated path.
 *
 * Paths are the same project-relative keys `generate()` puts on
 * `GenerationResult.files`. A path this generator does not classify
 * returns `unknown`. Callers must not recover a kind from the filename.
 *
 * Kind does not depend on config or `GenerateOptions`. Pass the same
 * string the generator emitted; do not strip a ZIP prefix here.
 */
export function getGeneratedFileKind(path: string): GeneratedFileKind {
  return GENERATED_FILE_KIND_CATALOG.get(path) ?? 'unknown';
}
