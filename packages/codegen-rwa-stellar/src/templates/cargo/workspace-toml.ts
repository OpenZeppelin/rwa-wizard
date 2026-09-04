import type { ConfigPath } from '@openzeppelin/codegen-core';

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
 * One member group and the config paths that produced it.
 *
 * Groups exist so the module-derived members can carry their own range without
 * that range covering the fixed core members (design Open Question 2). Their
 * concatenation, in order, must equal `WorkspaceTomlConfig.members`.
 */
export interface WorkspaceMemberGroup {
  readonly members: readonly string[];
  readonly paths: readonly ConfigPath[];
}

/** One element of the split literal, with whatever config shaped it. */
export interface WorkspaceTomlBlock {
  readonly text: string;
  readonly paths: readonly ConfigPath[];
}

/**
 * The workspace manifest as the ordered blocks that `'\n'` joins into it.
 *
 * This is the ONLY source of the manifest's bytes: `generateWorkspaceToml` is
 * `blocks.join('\n')`, and a line builder emitting the same blocks with
 * separator `'\n'` produces the identical string, because `LineBuilder.text()`
 * *is* `elements.join(separator)`. So the split's join identity (INV-6) holds
 * by construction rather than by inspection — there is no second emitter to
 * drift (INV-30).
 *
 * Split legality (INV-6): both cut points are newlines written literally in the
 * template source, outside every interpolation — the one ending `members = [`
 * and the one before `]`. The `${excludeBlock}[workspace.package]` adjacency is
 * NOT cut: no newline separates them, so a cut there would invent one.
 *
 * Empty groups are dropped, which is what keeps the grouping byte-exact:
 * joining the surviving group blocks with `'\n'` reproduces
 * `members.map(...).join('\n')` for any number of empty groups, including all
 * of them (INV-38).
 */
export function workspaceTomlBlocks(
  config: WorkspaceTomlConfig,
  memberGroups?: readonly WorkspaceMemberGroup[]
): readonly WorkspaceTomlBlock[] {
  const memberLine = (member: string): string => `    "${member}",`;
  const groups: readonly WorkspaceMemberGroup[] = memberGroups ?? [
    { members: config.members, paths: [] },
  ];
  const memberBlocks: WorkspaceTomlBlock[] = groups
    .filter((group) => group.members.length > 0)
    .map((group) => ({ text: group.members.map(memberLine).join('\n'), paths: group.paths }));
  // An entirely empty members list is still one (empty) element: that is exactly
  // the blank line the original literal produced between `[` and `]`.
  if (memberBlocks.length === 0) memberBlocks.push({ text: '', paths: [] });

  const { head, tail } = workspaceTomlFrame(config);
  return [{ text: head, paths: [] }, ...memberBlocks, { text: tail, paths: [] }];
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
  return workspaceTomlBlocks(config)
    .map((block) => block.text)
    .join('\n');
}

/** The head and tail of the split literal — everything that is not a member line. */
function workspaceTomlFrame(config: WorkspaceTomlConfig): { head: string; tail: string } {
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

  const head = `[workspace]
resolver = "2"
members = [`;

  const tail = `]

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

  return { head, tail };
}
