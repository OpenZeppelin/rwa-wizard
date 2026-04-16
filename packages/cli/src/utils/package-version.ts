import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@openzeppelin/rwa-wizard-cli';

/**
 * Reads `version` from this package's `package.json`.
 * Walks up from the executing file (e.g. `dist/index.mjs` or `dist/utils/*.js`)
 * until it finds this package's manifest — works for single-file and split bundles.
 */
export function getPackageVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 10; i++) {
      const pkgPath = join(dir, 'package.json');
      if (existsSync(pkgPath)) {
        const raw = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(raw) as { name?: string; version?: unknown };
        if (pkg.name === PACKAGE_NAME && typeof pkg.version === 'string') {
          return pkg.version;
        }
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // ignore
  }
  return '0.0.0';
}
