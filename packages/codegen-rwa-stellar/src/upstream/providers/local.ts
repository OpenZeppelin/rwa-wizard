import {
  assertTemplateSnapshotCompleteness,
  createSnapshotTemplateSource,
} from '@openzeppelin/codegen-core';

import {
  GENERATED_STELLAR_SOURCE_COMMIT_HASH,
  GENERATED_STELLAR_SOURCE_REPO_URL,
} from '../generated-revision';
import { getUpstreamTemplateKey, getUpstreamTemplateManifest } from '../manifest';
import type {
  UpstreamTemplateKind,
  UpstreamTemplateSnapshot,
  UpstreamTemplateSource,
  UpstreamTemplateSourceMetadata,
} from '../types';

interface BuiltinModuleProcess {
  versions?: { node?: string };
  getBuiltinModule?: (id: string) => unknown;
}

interface NodeFsModule {
  readFileSync(path: string, encoding: 'utf8'): string;
}

interface NodeChildProcessModule {
  execFileSync(
    command: string,
    args: string[],
    options: { cwd: string; encoding: 'utf8'; stdio: ['ignore', 'pipe', 'ignore'] }
  ): string;
}

/**
 * Read the ambient `process` object without hard-depending on Node globals.
 */
function getBuiltinModuleProcess(): BuiltinModuleProcess | undefined {
  return (globalThis as { process?: BuiltinModuleProcess }).process;
}

/**
 * Report whether the current runtime is Node.js, even if local-checkout
 * template loading is not supported.
 */
export function isNodeRuntime(): boolean {
  const proc = getBuiltinModuleProcess();
  return typeof proc?.versions?.node === 'string';
}

/**
 * Report whether the current runtime can safely read from a local checkout.
 */
export function canUseLocalCheckoutTemplateSource(): boolean {
  const proc = getBuiltinModuleProcess();
  return isNodeRuntime() && typeof proc?.getBuiltinModule === 'function';
}

/**
 * Lazily require a Node builtin through `process.getBuiltinModule()`.
 */
function requireBuiltinModule<TModule>(id: string): TModule {
  const proc = getBuiltinModuleProcess();
  if (!canUseLocalCheckoutTemplateSource() || !proc) {
    throw new Error(
      'Local upstream template sourcing requires a Node.js runtime with process.getBuiltinModule() support'
    );
  }

  const getBuiltinModule = proc.getBuiltinModule;
  if (!getBuiltinModule) {
    throw new Error(`Unable to access process.getBuiltinModule() for ${id}`);
  }

  const module = getBuiltinModule(id);
  if (!module) {
    throw new Error(`Unable to load required Node.js builtin module: ${id}`);
  }
  return module as TModule;
}

/**
 * Normalize a checkout root so relative file joins do not double up slashes.
 */
function trimTrailingSlashes(path: string): string {
  return path.replace(/\/+$/, '');
}

/**
 * Read a UTF-8 file from a local `stellar-contracts` checkout.
 */
function readTextFile(checkoutRoot: string, relativePath: string): string {
  const fs = requireBuiltinModule<NodeFsModule>('node:fs');
  return fs.readFileSync(`${trimTrailingSlashes(checkoutRoot)}/${relativePath}`, 'utf8');
}

/**
 * Resolve the git commit hash for a local checkout, with a pinned fallback.
 */
function resolveCommitHash(checkoutRoot: string): string {
  try {
    const childProcess = requireBuiltinModule<NodeChildProcessModule>('node:child_process');
    return childProcess
      .execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: checkoutRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .trim();
  } catch {
    return GENERATED_STELLAR_SOURCE_COMMIT_HASH;
  }
}

/**
 * Create a template source that reads directly from a local checkout.
 */
export function createLocalCheckoutTemplateSource(checkoutRoot: string): UpstreamTemplateSource {
  const snapshot: UpstreamTemplateSnapshot = {
    metadata: {
      sourceRepoUrl: GENERATED_STELLAR_SOURCE_REPO_URL,
      sourceCommitHash: resolveCommitHash(checkoutRoot),
      syncedAt: new Date().toISOString(),
    },
    templates: {},
  };

  for (const entry of getUpstreamTemplateManifest()) {
    snapshot.templates[getUpstreamTemplateKey(entry.kind, entry.id)] = {
      sourcePath: entry.sourcePath,
      content: readTextFile(checkoutRoot, entry.sourcePath),
    };
  }

  assertTemplateSnapshotCompleteness(snapshot, getUpstreamTemplateManifest());

  const metadata: UpstreamTemplateSourceMetadata = {
    ...snapshot.metadata,
    strategy: 'local-checkout',
    checkoutRoot,
  };

  return createSnapshotTemplateSource<UpstreamTemplateKind, UpstreamTemplateSourceMetadata>(
    snapshot,
    metadata
  );
}
