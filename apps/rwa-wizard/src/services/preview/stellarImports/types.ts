/** How upstream stellar workspace crates are resolved in the generated manifest. */
export type StellarDependencyMode = 'git-revision' | 'local-path';

/** Where commit/repo metadata was read from in the previewed tree. */
export type StellarRevisionProvenance = 'cargo-manifest' | 'readme-prose';

/**
 * Upstream source coordinates derived from generated preview content.
 * `commitHash` is null in local-path mode even if README prose mentions a checkout commit.
 */
export interface StellarSourceRevision {
  /** Browser URL without `.git` suffix, e.g. https://github.com/OpenZeppelin/stellar-contracts */
  readonly repoUrl: string;
  /** 40-char hex from Cargo.toml `rev`, or 7+ chars from README fallback; null when local-path. */
  readonly commitHash: string | null;
  readonly mode: StellarDependencyMode;
  readonly provenance: StellarRevisionProvenance;
}

/** One linkable crate identifier span inside a HAST text leaf. */
export interface StellarCrateMatch {
  /** Absolute offset in full `source` (UTF-16), aligned with SF-10 `CodeViewToken.offset`. */
  readonly start: number;
  readonly end: number;
  /** Rust path prefix identifier, e.g. `stellar_access`. */
  readonly crateId: string;
  readonly text: string;
}

/** Policy when `commitHash` is null (local-path degrade). */
export type StellarLinkDegradeMode = 'repo-root' | 'plain-text';

export interface StellarImportDecoratorOptions {
  /**
   * When manifest is local-path (no `rev`), link crate text to `repoUrl` root
   * (`repo-root`, default) or leave highlighted text (`plain-text`).
   */
  readonly degradeMode?: StellarLinkDegradeMode;
}
