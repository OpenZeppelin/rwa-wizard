import {
  RUST_EDITION,
  SOROBAN_SDK_VERSION,
  STELLAR_CONTRACTS_COMMIT_HASH,
  STELLAR_CONTRACTS_GIT_URL,
  WORKSPACE_CRATE_DEPS,
} from '../../constants';

export interface WorkspaceTomlConfig {
  members: string[];
  /** When set, resolve stellar-contracts crates via local path instead of git. */
  stellarContractsPath?: string;
}

/**
 * Generates the root workspace `Cargo.toml`.
 *
 * By default, stellar-contracts crates are pinned to a git revision.
 * When `stellarContractsPath` is provided, local path dependencies are
 * emitted instead, which is useful during development against an
 * unmerged branch of stellar-contracts.
 */
export function generateWorkspaceToml(config: WorkspaceTomlConfig): string {
  const membersBlock = config.members.map((m) => `    "${m}",`).join('\n');

  let depsBlock: string;
  if (config.stellarContractsPath) {
    const base = config.stellarContractsPath.replace(/\/+$/, '');
    depsBlock = WORKSPACE_CRATE_DEPS.map(
      (crate) => `${crate} = { path = "${base}/packages/${crate}" }`
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
edition = "${RUST_EDITION}"

[workspace.dependencies]
soroban-sdk = "${SOROBAN_SDK_VERSION}"
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
