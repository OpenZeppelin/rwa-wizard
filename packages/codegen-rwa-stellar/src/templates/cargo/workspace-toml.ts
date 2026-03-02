import {
  RUST_EDITION,
  SOROBAN_SDK_VERSION,
  STELLAR_CONTRACTS_COMMIT_HASH,
  STELLAR_CONTRACTS_GIT_URL,
  WORKSPACE_CRATE_DEPS,
} from '../../constants';

export interface WorkspaceTomlConfig {
  members: string[];
}

/**
 * Generates the root workspace `Cargo.toml` with git dependencies pinned
 * to a specific commit hash for stellar-contracts library crates and
 * soroban-sdk pinned to a specific version. Targets Rust edition 2021.
 */
export function generateWorkspaceToml(config: WorkspaceTomlConfig): string {
  const membersBlock = config.members.map((m) => `    "${m}",`).join('\n');

  const gitDeps = WORKSPACE_CRATE_DEPS.map(
    (crate) =>
      `${crate} = { git = "${STELLAR_CONTRACTS_GIT_URL}", rev = "${STELLAR_CONTRACTS_COMMIT_HASH}" }`
  ).join('\n');

  return `[workspace]
resolver = "2"
members = [
${membersBlock}
]

[workspace.package]
edition = "${RUST_EDITION}"

[workspace.dependencies]
soroban-sdk = "${SOROBAN_SDK_VERSION}"
${gitDeps}

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
