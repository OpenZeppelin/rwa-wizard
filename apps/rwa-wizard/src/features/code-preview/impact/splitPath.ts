/**
 * Split a generated file path into the two lines the column's file heading
 * renders: the leaf, which is what a reader actually identifies the file by,
 * and the directory, which is what distinguishes five files all named
 * `contract.rs`.
 *
 * `'contracts/rwa-token/src/contract.rs'` → `{ directory: 'contracts/rwa-token/src', leaf: 'contract.rs' }`
 * `'README.md'`                           → `{ directory: '', leaf: 'README.md' }`
 *
 * Total: never throws, for any string. A path ending in `/` yields an empty
 * leaf rather than an error — the heading then renders the directory alone,
 * which is degraded but honest, and no generator in this repo produces one.
 */
export interface SplitPath {
  /** Everything before the last `/`; `''` for a root-level file. */
  readonly directory: string;
  /** The last segment. Rendered first and never truncated (INV-31). */
  readonly leaf: string;
}

export function splitPath(path: string): SplitPath {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) {
    return { directory: '', leaf: path };
  }
  return { directory: path.slice(0, lastSlash), leaf: path.slice(lastSlash + 1) };
}

/**
 * The directory line, split so it can lose its middle rather than its end.
 *
 * `'contracts/modules/compliance-initial-lockup-period/src'`
 *   → `{ head: 'contracts/modules/compliance-initial-lockup-period', tail: '/src' }`
 *
 * Rendered as a shrink-priority pair (head yields first), that reads
 * `contracts/modules/compl…/src` instead of `contracts/modules/compliance-ini…`.
 * Both ends survive, and the end that survives an end-truncation is the useless
 * one: five generated files are named `contract.rs`, and what tells them apart
 * is the segment *nearest* the file, which is exactly what an end-ellipsis eats
 * first.
 *
 * Total: never throws. A single-segment directory yields an empty head and the
 * whole segment as the tail, which renders identically to the unsplit string.
 */
export interface SplitDirectory {
  /** Everything before the last segment. `''` when there is only one segment. */
  readonly head: string;
  /** The last segment, with its leading `/` when there is a head. Never empty for a non-empty input. */
  readonly tail: string;
}

export function splitDirectory(directory: string): SplitDirectory {
  const lastSlash = directory.lastIndexOf('/');
  if (lastSlash === -1) {
    return { head: '', tail: directory };
  }
  return { head: directory.slice(0, lastSlash), tail: directory.slice(lastSlash) };
}
