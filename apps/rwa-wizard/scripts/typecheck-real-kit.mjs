#!/usr/bin/env node
/**
 * Second typecheck pass with the ambient kit stubs excluded.
 *
 * `src/openzeppelin-ui-*.d.ts` declare unpublished kit exports. A script-file
 * `declare module` wins over a package's own declarations, so while those files
 * exist the normal `tsc` run never sees the real `BottomSheet`, `CodeView`, or
 * `FileTree` types — even when the package resolves them. That is how the stubs
 * drifted (both accessible-name props optional; `FileTree` typed as a plain
 * function rather than a forwardRef) without a single gate going red.
 *
 * When the real subpaths resolve (`pnpm dev:local`, or after SF-9 publishes
 * them) this re-runs `tsc` against them. When they do not (`pnpm dev:npm`) it
 * skips loudly rather than failing, because the stubs are the only types
 * available in that mode.
 *
 * Delete this script together with the stub files at SF-9.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REAL_KIT_SUBPATHS = [
  '@openzeppelin/ui-components/code-view',
  '@openzeppelin/ui-components/file-tree',
];

const require = createRequire(join(APP_ROOT, 'package.json'));

function unresolvedSubpaths() {
  return REAL_KIT_SUBPATHS.filter((subpath) => {
    try {
      require.resolve(subpath);
      return false;
    } catch {
      return true;
    }
  });
}

const missing = unresolvedSubpaths();

if (missing.length > 0) {
  console.log(
    `[typecheck-real-kit] skipped: ${missing.join(', ')} not published in this install.\n` +
      '[typecheck-real-kit] Run `pnpm dev:local` from the repo root to check against the real kit.'
  );
  process.exit(0);
}

console.log('[typecheck-real-kit] real kit subpaths resolved; typechecking without the stubs');

// Resolved through the module graph rather than PATH: a bare `tsc` spawn is not
// on PATH outside `pnpm exec` and would exit without ever running the check.
const tscBin = require.resolve('typescript/bin/tsc');

const result = spawnSync(process.execPath, [tscBin, '--noEmit', '-p', 'tsconfig.real-kit.json'], {
  cwd: APP_ROOT,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
