import { RUST_EDITION } from '../../constants';

export interface CrateTomlConfig {
  name: string;
  dependencies: string[];
}

/**
 * Generates a per-crate `Cargo.toml` for a generated contract crate.
 * Uses workspace-level dependency resolution.
 */
export function generateCrateToml(config: CrateTomlConfig): string {
  const deps = config.dependencies.map((dep) => `${dep} = { workspace = true }`).join('\n');

  const devDeps = config.dependencies.includes('soroban-sdk')
    ? '\n[dev-dependencies]\nsoroban-sdk = { workspace = true, features = ["testutils"] }\n'
    : '';

  return `[package]
name = "${config.name}"
edition = "${RUST_EDITION}"
publish = false
version = "0.1.0"

[lib]
crate-type = ["cdylib"]
doctest = false

[dependencies]
${deps}
${devDeps}`;
}
