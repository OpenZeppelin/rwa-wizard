import type { FileTree } from '@openzeppelin/codegen-core';

import type {
  StellarDependencyMode,
  StellarRevisionProvenance,
  StellarSourceRevision,
} from './types';

const STELLAR_WORKSPACE_LINE_RE =
  /^\s*stellar-(?:tokens|access|macros|contract-utils)\s*=\s*\{([^}]*)\}/;

const WORKSPACE_REPOSITORY_RE = /^\s*repository\s*=\s*"([^"]+)"/m;

const README_REPO_LINK_RE = /\[Stellar contracts source repository\]\(([^)]+)\)/;

const README_BUNDLED_COMMIT_RE = /synced from commit `([0-9a-f]{7,40})`/;

const README_LOCAL_COMMIT_RE = /at commit `([0-9a-f]{7,40})`/;

interface ParsedStellarLine {
  readonly path?: string;
  readonly git?: string;
  readonly rev?: string;
}

interface CargoParseResult {
  readonly mode: StellarDependencyMode;
  readonly repoUrl: string | null;
  readonly commitHash: string | null;
  readonly provenance: StellarRevisionProvenance;
}

/** Strip trailing `.git` and surrounding whitespace from a repository URL. */
export function normalizeRepoUrl(url: string): string {
  return url.trim().replace(/\.git$/, '');
}

function parseStellarLineValue(inner: string): ParsedStellarLine {
  return {
    path: inner.match(/path\s*=\s*"([^"]+)"/)?.[1],
    git: inner.match(/git\s*=\s*"([^"]+)"/)?.[1],
    rev: inner.match(/rev\s*=\s*"([^"]+)"/)?.[1],
  };
}

function parseWorkspaceRepository(manifest: string): string | null {
  const match = manifest.match(WORKSPACE_REPOSITORY_RE);
  return match ? normalizeRepoUrl(match[1]) : null;
}

function parseCargoManifest(manifest: string): CargoParseResult | null {
  const stellarLines: ParsedStellarLine[] = [];

  for (const line of manifest.split('\n')) {
    const match = line.match(STELLAR_WORKSPACE_LINE_RE);
    if (match) {
      stellarLines.push(parseStellarLineValue(match[1]));
    }
  }

  if (stellarLines.length === 0) {
    return null;
  }

  const hasLocalPath = stellarLines.some((line) => line.path !== undefined);
  if (hasLocalPath) {
    const repoUrl =
      stellarLines.map((line) => line.git).find((git) => git !== undefined) ??
      parseWorkspaceRepository(manifest);

    if (!repoUrl) {
      return null;
    }

    return {
      mode: 'local-path',
      repoUrl: normalizeRepoUrl(repoUrl),
      commitHash: null, // INV-3: local-path never pins a revision for URLs
      provenance: 'cargo-manifest',
    };
  }

  const revs = stellarLines
    .map((line) => line.rev)
    .filter((rev): rev is string => rev !== undefined);
  const uniqueRevs = [...new Set(revs)];

  if (uniqueRevs.length > 1) {
    return null; // INV-4: conflicting revs → fail closed
  }

  const repoUrl =
    stellarLines.map((line) => line.git).find((git) => git !== undefined) ??
    parseWorkspaceRepository(manifest);

  if (!repoUrl) {
    return null;
  }

  return {
    mode: 'git-revision',
    repoUrl: normalizeRepoUrl(repoUrl),
    commitHash: uniqueRevs[0] ?? null,
    provenance: 'cargo-manifest',
  };
}

function parseReadmeCommit(readme: string): string | null {
  return (
    readme.match(README_BUNDLED_COMMIT_RE)?.[1] ?? readme.match(README_LOCAL_COMMIT_RE)?.[1] ?? null
  );
}

function parseReadmeRepoUrl(readme: string): string | null {
  const match = readme.match(README_REPO_LINK_RE);
  return match ? normalizeRepoUrl(match[1]) : null;
}

function applyReadmeFallback(
  cargo: CargoParseResult,
  readme: string
): StellarSourceRevision | null {
  if (cargo.mode === 'local-path') {
    return {
      repoUrl: cargo.repoUrl!,
      commitHash: null,
      mode: cargo.mode,
      provenance: cargo.provenance,
    };
  }

  if (cargo.commitHash) {
    return {
      repoUrl: cargo.repoUrl!,
      commitHash: cargo.commitHash,
      mode: cargo.mode,
      provenance: cargo.provenance,
    };
  }

  const readmeCommit = parseReadmeCommit(readme);
  const repoUrl = cargo.repoUrl ?? parseReadmeRepoUrl(readme);

  if (!repoUrl) {
    return null;
  }

  return {
    repoUrl,
    commitHash: readmeCommit,
    mode: 'git-revision',
    provenance: readmeCommit ? 'readme-prose' : 'cargo-manifest',
  };
}

/**
 * Derive upstream repo + revision from the previewed generated tree.
 * Never imports from codegen packages (INV-1, INV-11).
 */
export function resolveStellarSourceRevision(files: FileTree): StellarSourceRevision | null {
  const manifest = files['Cargo.toml'];
  if (typeof manifest !== 'string' || manifest.length === 0) {
    return null; // INV-7
  }

  const cargo = parseCargoManifest(manifest);
  if (!cargo || !cargo.repoUrl) {
    return null;
  }

  const readme = files['README.md'];
  if (typeof readme === 'string' && readme.length > 0) {
    return applyReadmeFallback(cargo, readme);
  }

  if (cargo.mode === 'local-path') {
    return {
      repoUrl: cargo.repoUrl,
      commitHash: null,
      mode: cargo.mode,
      provenance: cargo.provenance,
    };
  }

  if (!cargo.commitHash) {
    return null;
  }

  return {
    repoUrl: cargo.repoUrl,
    commitHash: cargo.commitHash,
    mode: cargo.mode,
    provenance: cargo.provenance,
  };
}
