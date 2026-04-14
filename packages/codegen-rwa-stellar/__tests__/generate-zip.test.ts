import { describe, expect, it, vi } from 'vitest';

import type { ProgressCallback } from '@openzeppelin/codegen-core';

import { createValidConfig } from './helpers/config';
import {
  extractFilesFromZip,
  findFileContent,
  validateProjectStructure,
} from './utils/zip-inspector';
import { CRATE_NAMES } from '../src/constants';
import { generateZip } from '../src/index';
import { sanitizeDirectoryName } from '../src/stellar-rwa-generator';

describe('generateZip (US3)', () => {
  describe('sanitizeDirectoryName', () => {
    it('should lowercase the symbol and append -rwa', () => {
      expect(sanitizeDirectoryName('ACME')).toBe('acme-rwa');
    });

    it('should replace non-alphanumeric characters with hyphens', () => {
      expect(sanitizeDirectoryName('MY@TOKEN!')).toBe('my-token-rwa');
    });

    it('should collapse consecutive hyphens', () => {
      expect(sanitizeDirectoryName('A--B')).toBe('a-b-rwa');
    });

    it('should trim leading and trailing hyphens before appending -rwa', () => {
      expect(sanitizeDirectoryName('--ACME--')).toBe('acme-rwa');
    });

    it('should handle symbols with special characters', () => {
      expect(sanitizeDirectoryName('$TOKEN$')).toBe('token-rwa');
    });

    it('should handle already-lowercase symbols', () => {
      expect(sanitizeDirectoryName('acme')).toBe('acme-rwa');
    });

    it('should handle single-char symbol', () => {
      expect(sanitizeDirectoryName('A')).toBe('a-rwa');
    });

    it('should handle numeric-only symbols', () => {
      expect(sanitizeDirectoryName('123')).toBe('123-rwa');
    });
  });

  describe('root directory naming', () => {
    it('should use sanitized symbol as the root directory name', async () => {
      const config = createValidConfig();
      const result = await generateZip(config);

      const entries = await extractFilesFromZip(result.data);
      const rootDirs = new Set(entries.map((e) => e.path.split('/')[0]));

      expect(rootDirs.size).toBe(1);
      expect(rootDirs.has('acme-rwa')).toBe(true);
    });

    it('should use the sanitized directory name in the ZIP fileName', async () => {
      const config = createValidConfig();
      const result = await generateZip(config);

      expect(result.fileName).toBe('acme-rwa.zip');
    });
  });

  describe('content determinism', () => {
    it('should produce identical file sets for the same config', async () => {
      const config = createValidConfig();
      const result1 = await generateZip(config);
      const result2 = await generateZip(config);

      const entries1 = await extractFilesFromZip(result1.data);
      const entries2 = await extractFilesFromZip(result2.data);

      expect(entries1.map((e) => e.path)).toEqual(entries2.map((e) => e.path));
      for (let i = 0; i < entries1.length; i++) {
        expect(entries1[i].content).toEqual(entries2[i].content);
      }
    });

    it('should produce the same metadata for the same config', async () => {
      const config = createValidConfig();
      const result1 = await generateZip(config);
      const result2 = await generateZip(config);

      expect(result1.metadata.configHash).toBe(result2.metadata.configHash);
      expect(result1.metadata.generatorName).toBe(result2.metadata.generatorName);
      expect(result1.metadata.fileCount).toBe(result2.metadata.fileCount);
    });
  });

  describe('structural match against quickstart layout', () => {
    it('should contain all expected files under the root directory', async () => {
      const config = createValidConfig();
      const result = await generateZip(config);
      const entries = await extractFilesFromZip(result.data);
      const rootDir = 'acme-rwa';

      const coreContracts = Object.values(CRATE_NAMES);
      const expectedPaths: string[] = [
        `${rootDir}/Cargo.toml`,
        `${rootDir}/rustfmt.toml`,
        `${rootDir}/README.md`,
        `${rootDir}/config.json`,
        `${rootDir}/scripts/build.sh`,
        `${rootDir}/scripts/deploy.sh`,
      ];

      for (const contractName of coreContracts) {
        expectedPaths.push(
          `${rootDir}/contracts/${contractName}/Cargo.toml`,
          `${rootDir}/contracts/${contractName}/src/lib.rs`,
          `${rootDir}/contracts/${contractName}/src/contract.rs`
        );
      }

      const { missing } = validateProjectStructure(entries, expectedPaths);
      expect(missing).toEqual([]);
    });

    it('should preserve file content through ZIP round-trip', async () => {
      const config = createValidConfig();
      const result = await generateZip(config);
      const entries = await extractFilesFromZip(result.data);

      const cargoToml = findFileContent(entries, 'acme-rwa/Cargo.toml');
      expect(cargoToml).toContain('[workspace]');

      const readme = findFileContent(entries, 'acme-rwa/README.md');
      expect(readme).toContain('Acme Real Estate Token');

      const configJson = findFileContent(entries, 'acme-rwa/config.json');
      expect(configJson).toBeDefined();
      const parsed = JSON.parse(configJson!);
      expect(parsed.token.symbol).toBe('ACME');
    });
  });

  describe('no compliance modules', () => {
    it('should omit contracts/modules/ directory when no modules configured', async () => {
      const config = createValidConfig({ compliance: { modules: [] } });
      const result = await generateZip(config);
      const entries = await extractFilesFromZip(result.data);

      const modulePaths = entries.filter((e) => e.path.includes('contracts/modules/'));
      expect(modulePaths).toHaveLength(0);
    });
  });

  describe('ZipResult metadata', () => {
    it('should return a valid ZipResult with data, fileName, and metadata', async () => {
      const config = createValidConfig();
      const result = await generateZip(config);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('metadata');
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.metadata.generatorName).toBe('codegen-rwa-stellar');
      expect(result.metadata.fileCount).toBeGreaterThan(0);
    });
  });

  describe('progress callbacks', () => {
    it('should forward progress events when callback is provided', async () => {
      const config = createValidConfig();
      const onProgress: ProgressCallback = vi.fn();

      await generateZip(config, { onProgress });

      expect(onProgress).toHaveBeenCalled();
      const calls = (onProgress as ReturnType<typeof vi.fn>).mock.calls;
      for (const [event] of calls) {
        expect(event).toHaveProperty('phase');
        expect(event).toHaveProperty('percentage');
        expect(event.percentage).toBeGreaterThanOrEqual(0);
        expect(event.percentage).toBeLessThanOrEqual(100);
      }
    });

    it('should not throw when no progress callback is provided', async () => {
      const config = createValidConfig();
      await expect(generateZip(config)).resolves.not.toThrow();
    });
  });
});
