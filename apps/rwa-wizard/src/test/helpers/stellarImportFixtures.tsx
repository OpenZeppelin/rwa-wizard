import { render } from '@testing-library/react';
import { Fragment, type ReactElement } from 'react';

import type { CodeViewTokenDecorator } from '@openzeppelin/ui-components/code-view';

import { createStellarImportDecorator } from '../../services/preview/stellarImports';
import type { StructuralUpstreamSourceRevision } from '../../types/wizard';

export const STELLAR_REPO_URL = 'https://github.com/OpenZeppelin/stellar-contracts';
export const STELLAR_REPO_GIT = `${STELLAR_REPO_URL}.git`;

/** Distinct from the codegen package pin — proves the revision is the one supplied. */
export const FIXTURE_REV_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const FIXTURE_REV_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

/** Known codegen package pin — used only to assert stellarImports does not mirror it (INV-12). */
export const CODEGEN_PACKAGE_PIN = '4114bb8e2d7f090bdd9f45731e0607071d5ecea2';

export const SAMPLE_USE_SOURCE = [
  'use soroban_sdk::{contract, contractimpl, Address, Env};',
  'use stellar_access::access_control::{self as access_control, AccessControl};',
  'use stellar_tokens::fungible::{Base, FungibleToken};',
].join('\n');

export const SAMPLE_USE_LEAF = ' stellar_access::access_control::{';
export const SAMPLE_USE_LEAF_OFFSET = SAMPLE_USE_SOURCE.indexOf(SAMPLE_USE_LEAF);

/** Revision as the codegen service reports it for a pinned (default) generation. */
export function gitModeRevision(rev: string): StructuralUpstreamSourceRevision {
  return { repoUrl: STELLAR_REPO_URL, commitHash: rev, mode: 'git-revision' };
}

/** Revision as the codegen service reports it for a local-checkout generation. */
export function localPathRevision(): StructuralUpstreamSourceRevision {
  return { repoUrl: STELLAR_REPO_URL, commitHash: null, mode: 'local-path' };
}

/** Simulates the pane's memo: decorator rebuilt from a revision snapshot. */
export function memoizedPreviewLinks(revision: StructuralUpstreamSourceRevision | null): {
  revision: StructuralUpstreamSourceRevision | null;
  decorator: CodeViewTokenDecorator;
} {
  return { revision, decorator: createStellarImportDecorator(revision) };
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
