/** One linkable identifier span inside a HAST text leaf. */
export interface ImportIdentifierMatch {
  /** Absolute offset in full `source` (UTF-16), aligned with SF-10 `CodeViewToken.offset`. */
  readonly start: number;
  readonly end: number;
  /** The matched identifier, exactly as the codegen package reported it. */
  readonly identifier: string;
  readonly text: string;
}

/** Policy when `commitHash` is null (local-path degrade). */
export type ImportLinkDegradeMode = 'repo-root' | 'plain-text';

export interface ImportLinkDecoratorOptions {
  /**
   * When the revision pins no commit (local-path generation), link identifier
   * text to `repoUrl` root (`repo-root`, default) or leave highlighted text
   * (`plain-text`).
   */
  readonly degradeMode?: ImportLinkDegradeMode;
}
