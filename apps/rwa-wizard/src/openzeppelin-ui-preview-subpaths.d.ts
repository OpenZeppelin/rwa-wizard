/**
 * Ambient types for unpublished kit subpath exports until SF-9 pins the registry build.
 * Remove when `@openzeppelin/ui-components` publishes `./code-view` and `./file-tree`.
 * Absent under `pnpm dev:local` — real subpath types must not be shadowed.
 */
declare module '@openzeppelin/ui-components/code-view' {
  import type React from 'react';

  export type CodeViewLanguage = 'rust' | 'toml' | 'shell' | 'json' | 'markdown' | 'plaintext';

  export interface CodeViewToken {
    readonly text: string;
    readonly offset: number;
    readonly className?: string;
  }

  export interface CodeViewDecorationContext {
    readonly source: string;
    readonly language: CodeViewLanguage;
    readonly token: CodeViewToken;
  }

  export type CodeViewTokenDecorator = (
    context: CodeViewDecorationContext
  ) => React.ReactNode | null | undefined;

  export interface CodeViewProps {
    readonly source: string;
    readonly language: CodeViewLanguage;
    readonly className?: string;
    readonly 'aria-label'?: string;
    readonly decorateToken?: CodeViewTokenDecorator;
  }

  export function CodeView(props: CodeViewProps): React.ReactElement;
}

declare module '@openzeppelin/ui-components/file-tree' {
  import type React from 'react';

  export type FileTreePath = string;

  export type FileTreeProps = {
    readonly paths: readonly FileTreePath[];
    readonly selectedPath: FileTreePath | null;
    readonly onSelectedPathChange: (path: FileTreePath | null) => void;
    readonly changedPaths?: readonly FileTreePath[];
    readonly className?: string;
    readonly id?: string;
    readonly 'aria-label'?: string;
    readonly 'aria-labelledby'?: string;
  };

  export function FileTree(props: FileTreeProps): React.ReactElement;
}
