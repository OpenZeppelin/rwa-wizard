import type { FileTree } from '@openzeppelin/codegen-core';

const PREFERRED_README = 'README.md';

/** Prefer README.md, else lexicographic first path. INV-11 */
export function defaultSelectedPath(files: FileTree): string | null {
  const paths = Object.keys(files).sort();
  if (paths.length === 0) {
    return null;
  }

  if (paths.includes(PREFERRED_README)) {
    return PREFERRED_README;
  }

  return paths[0] ?? null;
}
