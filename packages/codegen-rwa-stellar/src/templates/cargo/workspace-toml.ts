import {
  SOROBAN_SDK_VERSION,
  STELLAR_CONTRACTS_AUTHORS,
  STELLAR_CONTRACTS_COMMIT_HASH,
  STELLAR_CONTRACTS_GIT_URL,
  STELLAR_CONTRACTS_LICENSE,
  STELLAR_CONTRACTS_REPOSITORY_URL,
  STELLAR_CONTRACTS_VERSION,
  WORKSPACE_CRATE_DEPS,
  WORKSPACE_CRATE_PACKAGE_PATHS,
} from '../../constants';

export interface WorkspaceTomlConfig {
  members: string[];
  /** When set, resolve upstream contract crates via local path instead of git. */
  contractsLibraryPath?: string;
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

  let depsBlock: string;
  if (config.contractsLibraryPath) {
    const base = config.contractsLibraryPath.replace(/\/+$/, '');
    depsBlock = WORKSPACE_CRATE_DEPS.map(
      (crate) => `${crate} = { path = "${base}/packages/${WORKSPACE_CRATE_PACKAGE_PATHS[crate]}" }`
    ).join('\n');
  } else {
    depsBlock = WORKSPACE_CRATE_DEPS.map(
      (crate) =>
        `${crate} = { git = "${STELLAR_CONTRACTS_GIT_URL}", rev = "${STELLAR_CONTRACTS_COMMIT_HASH}" }`
    ).join('\n');
  }

  return `[workspace]
resolver = "2"
members = [
${membersBlock}
]

[workspace.package]
authors = ["${STELLAR_CONTRACTS_AUTHORS.join('", "')}"]
edition = "2021"
license = "${STELLAR_CONTRACTS_LICENSE}"
repository = "${STELLAR_CONTRACTS_REPOSITORY_URL}"
version = "${STELLAR_CONTRACTS_VERSION}"

[workspace.dependencies]
soroban-sdk = { version = "${SOROBAN_SDK_VERSION}", features = ["experimental_spec_shaking_v2"] }
${depsBlock}

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
