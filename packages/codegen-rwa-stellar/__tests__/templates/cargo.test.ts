import { describe, expect, it } from 'vitest';

import {
  RUST_EDITION,
  SOROBAN_SDK_VERSION,
  STELLAR_CONTRACTS_COMMIT_HASH,
  STELLAR_CONTRACTS_GIT_URL,
} from '../../src/constants';
import { generateCrateToml } from '../../src/templates/cargo/crate-toml';
import { generateWorkspaceToml } from '../../src/templates/cargo/workspace-toml';

describe('Per-crate Cargo.toml Template', () => {
  it('should include crate name', () => {
    const output = generateCrateToml({
      name: 'rwa-token',
      dependencies: ['soroban-sdk'],
    });

    expect(output).toContain('name = "rwa-token"');
  });

  it('should set crate-type to cdylib', () => {
    const output = generateCrateToml({
      name: 'test-crate',
      dependencies: ['soroban-sdk'],
    });

    expect(output).toContain('crate-type = ["cdylib"]');
  });

  it('should inherit workspace package metadata', () => {
    const output = generateCrateToml({
      name: 'test-crate',
      dependencies: ['soroban-sdk'],
    });

    expect(output).toContain('edition.workspace = true');
    expect(output).toContain('license.workspace = true');
    expect(output).toContain('repository.workspace = true');
    expect(output).toContain('version.workspace = true');
    expect(output).toContain('authors.workspace = true');
  });

  it('should include workspace dependencies', () => {
    const output = generateCrateToml({
      name: 'test-crate',
      dependencies: ['soroban-sdk', 'stellar-access', 'stellar-tokens'],
    });

    expect(output).toContain('soroban-sdk = { workspace = true }');
    expect(output).toContain('stellar-access = { workspace = true }');
    expect(output).toContain('stellar-tokens = { workspace = true }');
  });

  it('should include dev-dependencies for soroban-sdk testutils', () => {
    const output = generateCrateToml({
      name: 'test-crate',
      dependencies: ['soroban-sdk'],
    });

    expect(output).toContain('[dev-dependencies]');
    expect(output).toContain('soroban-sdk = { workspace = true, features = ["testutils"] }');
  });

  it('should set publish to false', () => {
    const output = generateCrateToml({
      name: 'test-crate',
      dependencies: ['soroban-sdk'],
    });

    expect(output).toContain('publish = false');
  });

  it('should disable doctests', () => {
    const output = generateCrateToml({
      name: 'test-crate',
      dependencies: ['soroban-sdk'],
    });

    expect(output).toContain('doctest = false');
  });

  it('should include stellar cargo inheritance metadata', () => {
    const output = generateCrateToml({
      name: 'test-crate',
      dependencies: ['soroban-sdk'],
    });

    expect(output).toContain('[package.metadata.stellar]');
    expect(output).toContain('cargo_inherit = true');
  });
});

describe('Workspace Cargo.toml Template', () => {
  it('should include all workspace members', () => {
    const members = ['contracts/rwa-token', 'contracts/compliance', 'contracts/identity-verifier'];

    const output = generateWorkspaceToml({ members });

    for (const member of members) {
      expect(output).toContain(`"${member}"`);
    }
  });

  it('should pin soroban-sdk to specific version', () => {
    const output = generateWorkspaceToml({
      members: ['contracts/test'],
    });

    expect(output).toContain(`version = "${SOROBAN_SDK_VERSION}"`);
    expect(output).toContain('experimental_spec_shaking_v2');
  });

  it('should pin stellar-contracts git deps to specific commit hash', () => {
    const output = generateWorkspaceToml({
      members: ['contracts/test'],
    });

    const expectedCrates = [
      'stellar-tokens',
      'stellar-access',
      'stellar-macros',
      'stellar-contract-utils',
    ];

    for (const crate of expectedCrates) {
      expect(output).toContain(
        `${crate} = { git = "${STELLAR_CONTRACTS_GIT_URL}", rev = "${STELLAR_CONTRACTS_COMMIT_HASH}" }`
      );
    }
  });

  it('should map local stellar-contracts package paths correctly', () => {
    const output = generateWorkspaceToml({
      members: ['contracts/test'],
      contractsLibraryPath: '/tmp/stellar-contracts',
    });

    expect(output).toContain('stellar-tokens = { path = "/tmp/stellar-contracts/packages/tokens" }');
    expect(output).toContain('stellar-access = { path = "/tmp/stellar-contracts/packages/access" }');
    expect(output).toContain('stellar-macros = { path = "/tmp/stellar-contracts/packages/macros" }');
    expect(output).toContain(
      'stellar-contract-utils = { path = "/tmp/stellar-contracts/packages/contract-utils" }'
    );
  });

  it('should use Rust edition 2021', () => {
    const output = generateWorkspaceToml({
      members: ['contracts/test'],
    });

    expect(output).toContain(`edition = "${RUST_EDITION}"`);
  });

  it('should use workspace resolver version 2', () => {
    const output = generateWorkspaceToml({
      members: ['contracts/test'],
    });

    expect(output).toContain('resolver = "2"');
  });

  it('should include release profile with optimizations', () => {
    const output = generateWorkspaceToml({
      members: ['contracts/test'],
    });

    expect(output).toContain('[profile.release]');
    expect(output).toContain('opt-level = "z"');
  });

  it('should use local path deps when stellarContractsPath is provided', () => {
    const output = generateWorkspaceToml({
      members: ['contracts/test'],
      stellarContractsPath: '/home/user/stellar-contracts',
    });

    expect(output).toContain('stellar-tokens = { path = "/home/user/stellar-contracts/packages/stellar-tokens" }');
    expect(output).toContain('stellar-access = { path = "/home/user/stellar-contracts/packages/stellar-access" }');
    expect(output).not.toContain('git =');
    expect(output).not.toContain('rev =');
  });

  it('should strip trailing slash from stellarContractsPath', () => {
    const output = generateWorkspaceToml({
      members: ['contracts/test'],
      stellarContractsPath: '/home/user/stellar-contracts/',
    });

    expect(output).toContain('path = "/home/user/stellar-contracts/packages/stellar-tokens"');
  });
});
