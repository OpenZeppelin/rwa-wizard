export interface CrateTomlConfig {
  name: string;
  dependencies: string[];
  includeRlib?: boolean;
}

/**
 * Generates a per-crate `Cargo.toml` for a generated contract crate.
 * Uses workspace-level dependency resolution.
 */
export function generateCrateToml(config: CrateTomlConfig): string {
  const deps = config.dependencies.map((dep) => `${dep} = { workspace = true }`).join('\n');
  const crateTypes = config.includeRlib ? '["cdylib", "rlib"]' : '["cdylib"]';

  const devDeps = config.dependencies.includes('soroban-sdk')
    ? '\n[dev-dependencies]\nsoroban-sdk = { workspace = true, features = ["testutils"] }\n'
    : '';

  return `[package]
name = "${config.name}"
edition.workspace = true
license.workspace = true
repository.workspace = true
publish = false
version.workspace = true
authors.workspace = true

[package.metadata.stellar]
cargo_inherit = true

[lib]
crate-type = ${crateTypes}
doctest = false

[dependencies]
${deps}
${devDeps}`;
}
