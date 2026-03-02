import type { FileTree } from './types';

/**
 * Create a new FileTree with a single file entry.
 */
export function createFile(path: string, content: string | Uint8Array): FileTree {
  return { [path]: content };
}

/**
 * Merge multiple FileTrees into one.
 * Later entries override earlier ones for the same path.
 */
export function mergeFileTrees(...trees: FileTree[]): FileTree {
  const merged: FileTree = {};
  for (const tree of trees) {
    for (const [path, content] of Object.entries(tree)) {
      merged[path] = content;
    }
  }
  return merged;
}

/**
 * Add a file to an existing FileTree (returns a new object).
 */
export function addFile(tree: FileTree, path: string, content: string | Uint8Array): FileTree {
  return { ...tree, [path]: content };
}

/**
 * Add a prefix to all paths in a FileTree (e.g., wrap in a root directory).
 */
export function prefixPaths(tree: FileTree, prefix: string): FileTree {
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const prefixed: FileTree = {};
  for (const [path, content] of Object.entries(tree)) {
    prefixed[`${normalizedPrefix}${path}`] = content;
  }
  return prefixed;
}

/**
 * Get a sorted list of all file paths in a FileTree.
 */
export function getFilePaths(tree: FileTree): string[] {
  return Object.keys(tree).sort();
}

/**
 * Count the number of files in a FileTree.
 */
export function getFileCount(tree: FileTree): number {
  return Object.keys(tree).length;
}
