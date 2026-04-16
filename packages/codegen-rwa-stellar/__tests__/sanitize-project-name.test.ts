import { describe, expect, it } from 'vitest';

import {
  sanitizeDirectoryName,
  sanitizeTokenSymbolDirectoryBase,
} from '../src/sanitize-project-name';

describe('sanitize-project-name', () => {
  it('sanitizeDirectoryName should append -rwa to the sanitized base', () => {
    expect(sanitizeDirectoryName('ACME')).toBe('acme-rwa');
    expect(sanitizeTokenSymbolDirectoryBase('ACME')).toBe('acme');
  });

  it('validateTokenSymbol alignment: empty base matches unusable symbols', () => {
    expect(sanitizeTokenSymbolDirectoryBase('!!!')).toBe('');
  });
});
