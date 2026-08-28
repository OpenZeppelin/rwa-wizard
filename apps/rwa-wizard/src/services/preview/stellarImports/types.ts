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
   * When the revision pins no commit (local-path generation), link crate text
   * to `repoUrl` root (`repo-root`, default) or leave highlighted text
   * (`plain-text`).
   */
  readonly degradeMode?: StellarLinkDegradeMode;
}
