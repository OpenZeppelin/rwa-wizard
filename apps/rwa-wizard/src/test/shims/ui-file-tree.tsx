import type { ReactElement } from 'react';

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

export function FileTree(props: FileTreeProps): ReactElement {
  return (
    <div aria-label={props['aria-label']} data-testid="file-tree">
      <span data-testid="path-count">{props.paths.length}</span>
      <span data-testid="changed-count">{props.changedPaths?.length ?? 0}</span>
      <span data-testid="selected-path">{props.selectedPath ?? 'none'}</span>
    </div>
  );
}
