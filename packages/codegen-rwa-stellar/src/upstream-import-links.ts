import { WORKSPACE_CRATE_DEPS, WORKSPACE_CRATE_PACKAGE_PATHS } from './constants';

/** One identifier the generated source imports, and where it lives upstream. */
export interface UpstreamImportTarget {
  /**
   * Identifier as it appears in generated source — the Cargo package name with
   * hyphens replaced, which is how Rust names the crate at a `use` site.
   */
  readonly identifier: string;
  /** Path of that crate inside the upstream repository, no leading slash. */
  readonly path: string;
}

/**
 * Everything a consumer needs to turn imports in the generated source into
 * links to upstream, without knowing anything about this chain.
 */
export interface UpstreamImportLinks {
  /** Language id of the files these identifiers appear in. */
  readonly language: string;
  /**
   * A line declares an import only if it starts with this prefix once leading
   * whitespace is trimmed. Consumers use it to skip incidental mentions in
   * comments and strings; it lives here because it is the generated language's
   * syntax, not the consumer's.
   */
  readonly importLinePrefix: string;
  readonly targets: readonly UpstreamImportTarget[];
}

/** Cargo package names become Rust crate identifiers with `-` replaced by `_`. */
function crateIdentifier(packageName: string): string {
  return packageName.replace(/-/g, '_');
}

/**
 * Report the upstream import targets the generated source resolves against.
 *
 * Pairs with `getUpstreamSourceRevision`: that answers *which revision*, this
 * answers *which identifiers and where they live*, so a consumer can link a
 * generated `use` line to its source without parsing generated files or
 * carrying a copy of this map.
 */
export function getUpstreamImportLinks(): UpstreamImportLinks {
  return {
    language: 'rust',
    importLinePrefix: 'use ',
    targets: WORKSPACE_CRATE_DEPS.map((crate) => ({
      identifier: crateIdentifier(crate),
      path: `packages/${WORKSPACE_CRATE_PACKAGE_PATHS[crate]}`,
    })),
  };
}
