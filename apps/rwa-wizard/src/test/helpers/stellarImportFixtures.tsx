import { render } from '@testing-library/react';
import { Fragment, type ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';
import type { CodeViewTokenDecorator } from '@openzeppelin/ui-components/code-view';

import {
  createStellarImportDecorator,
  resolveStellarSourceRevision,
  type StellarSourceRevision,
} from '../../services/preview/stellarImports';

export const STELLAR_REPO_URL = 'https://github.com/OpenZeppelin/stellar-contracts';
export const STELLAR_REPO_GIT = `${STELLAR_REPO_URL}.git`;

/** Distinct from the codegen package pin — proves tree-sourced revision (INV-1). */
export const FIXTURE_REV_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const FIXTURE_REV_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export const README_ONLY_COMMIT = 'cafebabecafebabecafebabecafebabecafebabe';

/** Known codegen package pin — used only to assert stellarImports does not mirror it (INV-1/12). */
export const CODEGEN_PACKAGE_PIN = '4114bb8e2d7f090bdd9f45731e0607071d5ecea2';

/** README prose hash that must not become a link target in local-path mode (INV-3). */
export const README_PROSE_COMMIT = CODEGEN_PACKAGE_PIN.slice(0, 7);

export const SAMPLE_USE_SOURCE = [
  'use soroban_sdk::{contract, contractimpl, Address, Env};',
  'use stellar_access::access_control::{self as access_control, AccessControl};',
  'use stellar_tokens::fungible::{Base, FungibleToken};',
].join('\n');

export const SAMPLE_USE_LEAF = ' stellar_access::access_control::{';
export const SAMPLE_USE_LEAF_OFFSET = SAMPLE_USE_SOURCE.indexOf(SAMPLE_USE_LEAF);

export function gitModeManifest(rev: string, repoUrl: string = STELLAR_REPO_GIT): string {
  return `[workspace]
resolver = "2"
members = [
    "contracts/rwa-token",
]

[workspace.package]
authors = ["OpenZeppelin"]
edition = "2021"
license = "MIT"
repository = "${STELLAR_REPO_URL}"
version = "0.0.1"

[workspace.dependencies]
soroban-sdk = { version = "=22.0.0", features = ["experimental_spec_shaking_v2"] }
stellar-tokens = { git = "${repoUrl}", rev = "${rev}" }
stellar-access = { git = "${repoUrl}", rev = "${rev}" }
stellar-macros = { git = "${repoUrl}", rev = "${rev}" }
stellar-contract-utils = { git = "${repoUrl}", rev = "${rev}" }
`;
}

export function localPathManifest(basePath = '../stellar-contracts'): string {
  return `[workspace]
resolver = "2"
members = [
    "contracts/rwa-token",
]

[workspace.package]
authors = ["OpenZeppelin"]
edition = "2021"
license = "MIT"
repository = "${STELLAR_REPO_URL}"
version = "0.0.1"

[workspace.dependencies]
soroban-sdk = { version = "=22.0.0", features = ["experimental_spec_shaking_v2"] }
stellar-tokens = { path = "${basePath}/packages/tokens" }
stellar-access = { path = "${basePath}/packages/access" }
stellar-macros = { path = "${basePath}/packages/macros" }
stellar-contract-utils = { path = "${basePath}/packages/contract-utils" }
`;
}

export function gitModeManifestWithoutRev(repoUrl: string = STELLAR_REPO_GIT): string {
  return `[workspace]
resolver = "2"
members = [
    "contracts/rwa-token",
]

[workspace.package]
repository = "${STELLAR_REPO_URL}"

[workspace.dependencies]
stellar-tokens = { git = "${repoUrl}" }
stellar-access = { git = "${repoUrl}" }
stellar-macros = { git = "${repoUrl}" }
stellar-contract-utils = { git = "${repoUrl}" }
`;
}

export function conflictingRevManifest(): string {
  return `[workspace]
resolver = "2"
members = ["contracts/rwa-token"]

[workspace.package]
repository = "${STELLAR_REPO_URL}"

[workspace.dependencies]
stellar-tokens = { git = "${STELLAR_REPO_GIT}", rev = "${FIXTURE_REV_A}" }
stellar-access = { git = "${STELLAR_REPO_GIT}", rev = "${FIXTURE_REV_B}" }
stellar-macros = { git = "${STELLAR_REPO_GIT}", rev = "${FIXTURE_REV_A}" }
stellar-contract-utils = { git = "${STELLAR_REPO_GIT}", rev = "${FIXTURE_REV_A}" }
`;
}

export function bundledReadme(commit = README_ONLY_COMMIT): string {
  return `Contract source was generated from a bundled snapshot of the [Stellar contracts source repository](${STELLAR_REPO_URL}) examples synced from commit \`${commit.slice(0, 7)}\`. See \`Cargo.toml\` for the exact dependency source used by this project.`;
}

export function localCheckoutReadme(commit = README_PROSE_COMMIT): string {
  return `Contract source was generated from a local checkout of the [Stellar contracts source repository](${STELLAR_REPO_URL}) at commit \`${commit}\`. The workspace \`Cargo.toml\` resolves upstream crates via local path dependencies for this generation.`;
}

export function previewTree(manifest: string, readme?: string, extra: FileTree = {}): FileTree {
  return {
    'Cargo.toml': manifest,
    ...(readme !== undefined ? { 'README.md': readme } : {}),
    ...extra,
  };
}

export function gitModeTree(rev: string, readme?: string): FileTree {
  return previewTree(gitModeManifest(rev), readme);
}

export function localPathTree(readme?: string): FileTree {
  return previewTree(localPathManifest(), readme);
}

/** Simulates SF-8 memo: revision from files, decorator from revision snapshot. */
export function memoizedPreviewLinks(files: FileTree): {
  revision: StellarSourceRevision | null;
  decorator: CodeViewTokenDecorator;
} {
  const revision = resolveStellarSourceRevision(files);
  const decorator = createStellarImportDecorator(revision);
  return { revision, decorator };
}

export function hrefFromDecorator(
  decorator: CodeViewTokenDecorator,
  source: string = SAMPLE_USE_SOURCE,
  tokenText: string = SAMPLE_USE_LEAF,
  offset: number = SAMPLE_USE_LEAF_OFFSET
): string | undefined {
  const node = decorator({
    source,
    language: 'rust',
    token: { text: tokenText, offset },
  });

  if (node === undefined || node === null) {
    return undefined;
  }

  const { container } = render(<Fragment>{node as ReactElement}</Fragment>);
  return container.querySelector('a')?.getAttribute('href') ?? undefined;
}

export function anchorCountFromDecorator(
  decorator: CodeViewTokenDecorator,
  source: string = SAMPLE_USE_SOURCE,
  tokenText: string = SAMPLE_USE_LEAF,
  offset: number = SAMPLE_USE_LEAF_OFFSET
): number {
  const node = decorator({
    source,
    language: 'rust',
    token: { text: tokenText, offset },
  });

  if (node === undefined || node === null) {
    return 0;
  }

  const { container } = render(<Fragment>{node as ReactElement}</Fragment>);
  return container.querySelectorAll('a').length;
}

export const FORBIDDEN_COMMIT_PINNED_URL_PATTERNS = [
  { name: '40-char commit tree segment', pattern: /\/tree\/[0-9a-f]{40}\// },
  { name: 'short commit tree segment', pattern: /\/tree\/[0-9a-f]{7,39}\// },
  { name: 'main branch tree segment', pattern: /\/tree\/main(?:\/|$)/ },
  { name: 'master branch tree segment', pattern: /\/tree\/master(?:\/|$)/ },
  { name: 'tag-like tree segment', pattern: /\/tree\/v[0-9]/ },
  { name: 'blob ref segment', pattern: /\/blob\// },
] as const;
