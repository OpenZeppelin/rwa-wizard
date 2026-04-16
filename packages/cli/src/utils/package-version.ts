import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Reads `version` from this package's `package.json` (next to `dist/`). */
export function getPackageVersion(): string {
  const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const raw = readFileSync(join(packageDir, 'package.json'), 'utf-8');
  const pkg = JSON.parse(raw) as { version?: unknown };
  return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
}
