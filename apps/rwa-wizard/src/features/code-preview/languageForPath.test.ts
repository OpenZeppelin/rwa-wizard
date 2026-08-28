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
    // INV-8 exclusion: this map is CodeView grammars, not ranking kinds.
    // sign-claim is .rs so it highlights as rust; getGeneratedFileKind reports unknown.
    ['tools/sign-claim/src/main.rs', 'rust'],
  ] as const)('maps %s → %s', (path, expected) => {
    expect(languageForPath(path)).toBe(expected);
  });
});
