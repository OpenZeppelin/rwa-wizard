/**
 * Ambient types for unpublished kit subpath exports until SF-9 pins the registry build.
 * Remove when `@openzeppelin/ui-components` publishes `./code-view` and `./file-tree`.
 *
 * These declarations SHADOW the real subpath types whenever the package does
 * resolve them, including under `pnpm dev:local` — TypeScript prefers a
 * script-file `declare module` over the package's own declarations, and nothing
 * removes this file. `pnpm typecheck` therefore also runs `scripts/typecheck-real-kit.mjs`,
 * which re-runs `tsc` with this file excluded whenever the real subpaths resolve.
 * Keep every declaration below faithful to the kit or that second pass fails.
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

  export type FileTreeAccessibleName =
    | { 'aria-label': string; 'aria-labelledby'?: never }
    | { 'aria-labelledby': string; 'aria-label'?: never };

  export type FileTreeProps = FileTreeAccessibleName & {
    paths: readonly FileTreePath[];
    selectedPath: FileTreePath | null;
    onSelectedPathChange: (path: FileTreePath | null) => void;
    changedPaths?: readonly FileTreePath[];
    className?: string;
    id?: string;
  };

  export const FileTree: React.ForwardRefExoticComponent<
    FileTreeProps & React.RefAttributes<HTMLElement>
  >;
}
