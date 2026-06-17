import {
  SOROBAN_SDK_VERSION,
  STELLAR_CONTRACTS_AUTHORS,
  STELLAR_CONTRACTS_LICENSE,
  STELLAR_CONTRACTS_VERSION,
  WORKSPACE_CRATE_DEPS,
  WORKSPACE_CRATE_PACKAGE_PATHS,
} from '../../constants';
import {
  GENERATED_STELLAR_SOURCE_COMMIT_HASH,
  GENERATED_STELLAR_SOURCE_REPO_URL,
} from '../../upstream/generated-revision';

export interface WorkspaceTomlConfig {
  members: string[];
  /** Paths under the workspace root that Cargo should ignore. */
  exclude?: string[];
  /** Additional registry dependencies needed by optional generated helper crates. */
  extraWorkspaceDependencies?: Record<string, string>;
  /** When set, resolve upstream contract crates via local path instead of git. */
  contractsLibraryPath?: string;
  /** Source repository recorded in workspace package metadata. */
  repositoryUrl?: string;
}

function toRepositoryMetadataUrl(sourceRepoUrl: string): string {
  return sourceRepoUrl.replace(/\.git$/, '');
}

/**
 * Generates the root workspace `Cargo.toml`.
 *
 * By default, stellar-contracts crates are pinned to a git revision.
 * When `contractsLibraryPath` is provided, local path dependencies are
 * emitted instead, which is useful during development against an
 * unmerged branch of stellar-contracts.
 */
export function generateWorkspaceToml(config: WorkspaceTomlConfig): string {
  const membersBlock = config.members.map((m) => `    "${m}",`).join('\n');
  const excludeBlock =
    config.exclude && config.exclude.length > 0
      ? `exclude = [
${config.exclude.map((m) => `    "${m}",`).join('\n')}
]

`
      : '';
  const repositoryUrl = toRepositoryMetadataUrl(
    config.repositoryUrl ?? GENERATED_STELLAR_SOURCE_REPO_URL
  );
  const extraDepsBlock = Object.entries(config.extraWorkspaceDependencies ?? {})
    .map(([dependency, spec]) => `${dependency} = ${spec}`)
    .join('\n');

  let depsBlock: string;
  if (config.contractsLibraryPath) {
    const base = config.contractsLibraryPath.replace(/\/+$/, '');
    depsBlock = WORKSPACE_CRATE_DEPS.map(
      (crate) => `${crate} = { path = "${base}/packages/${WORKSPACE_CRATE_PACKAGE_PATHS[crate]}" }`
    ).join('\n');
  } else {
    depsBlock = WORKSPACE_CRATE_DEPS.map(
      (crate) =>
        `${crate} = { git = "${GENERATED_STELLAR_SOURCE_REPO_URL}", rev = "${GENERATED_STELLAR_SOURCE_COMMIT_HASH}" }`
    ).join('\n');
  }

  return `[workspace]
resolver = "2"
members = [
${membersBlock}
]

${excludeBlock}[workspace.package]
authors = ["${STELLAR_CONTRACTS_AUTHORS.join('", "')}"]
edition = "2021"
license = "${STELLAR_CONTRACTS_LICENSE}"
repository = "${repositoryUrl}"
version = "${STELLAR_CONTRACTS_VERSION}"

[workspace.dependencies]
soroban-sdk = { version = "=${SOROBAN_SDK_VERSION}", features = ["experimental_spec_shaking_v2"] }
${depsBlock}${extraDepsBlock ? `\n${extraDepsBlock}` : ''}

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
`;
}
