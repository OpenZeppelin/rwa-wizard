import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { getPackageVersion } from '../src/utils/package-version';

const PKG_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

describe('getPackageVersion', () => {
  it('matches packages/cli package.json version', () => {
    const expected = JSON.parse(readFileSync(PKG_PATH, 'utf-8')) as { version: string };
    expect(getPackageVersion()).toBe(expected.version);
  });
});
