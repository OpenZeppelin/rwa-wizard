import { describe, expect, it } from 'vitest';

import { languageForPath } from './languageForPath';

describe('languageForPath (INV-19)', () => {
  it.each([
    ['rwa-token/src/contract.rs', 'rust'],
    ['Cargo.toml', 'toml'],
    ['deploy.sh', 'shell'],
    ['config.json', 'json'],
    ['README.md', 'markdown'],
    ['LICENSE', 'plaintext'],
    ['notes.TXT', 'plaintext'],
  ] as const)('maps %s → %s', (path, expected) => {
    expect(languageForPath(path)).toBe(expected);
  });
});
