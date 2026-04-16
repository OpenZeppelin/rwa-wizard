import { describe, expect, it, vi } from 'vitest';

import { extractFilesFromZip, findFileContent } from './utils/zip-inspector';

import { CoreProgressPhase } from '../src/progress-phases';
import type { FileTree, ProgressCallback } from '../src/types';
import { generateZipFromFileTree } from '../src/zip-generator';

describe('ZipGenerator', () => {
  const sampleTree: FileTree = {
    'src/main.rs': '#![no_std]\nfn main() {}',
    'Cargo.toml': '[package]\nname = "test"',
    'README.md': '# Test Project',
  };

  describe('generateZipFromFileTree', () => {
    it('should produce a ZIP blob from a FileTree', async () => {
      const result = await generateZipFromFileTree(sampleTree, 'test-project');

      expect(result.data).toBeInstanceOf(Blob);
      expect(result.data.size).toBeGreaterThan(0);
    });

    it('should set the correct fileName with .zip extension', async () => {
      const result = await generateZipFromFileTree(sampleTree, 'my-project');
      expect(result.fileName).toBe('my-project.zip');
    });

    it('should not double-add .zip if already present', async () => {
      const result = await generateZipFromFileTree(sampleTree, 'my-project.zip');
      expect(result.fileName).toBe('my-project.zip');
    });

    it('should contain all files from the FileTree under the root directory', async () => {
      const result = await generateZipFromFileTree(sampleTree, 'test-project');
      const entries = await extractFilesFromZip(result.data);

      const paths = entries.map((e) => e.path);
      expect(paths).toContain('test-project/src/main.rs');
      expect(paths).toContain('test-project/Cargo.toml');
      expect(paths).toContain('test-project/README.md');
    });

    it('should preserve file content accurately', async () => {
      const result = await generateZipFromFileTree(sampleTree, 'test-project');
      const entries = await extractFilesFromZip(result.data);

      const main = findFileContent(entries, 'test-project/src/main.rs');
      expect(main).toBe('#![no_std]\nfn main() {}');

      const cargo = findFileContent(entries, 'test-project/Cargo.toml');
      expect(cargo).toBe('[package]\nname = "test"');
    });

    it('should produce content-deterministic output (same FileTree → same file contents)', async () => {
      const result1 = await generateZipFromFileTree(sampleTree, 'test-project');
      const result2 = await generateZipFromFileTree(sampleTree, 'test-project');

      const entries1 = await extractFilesFromZip(result1.data);
      const entries2 = await extractFilesFromZip(result2.data);

      expect(entries1.map((e) => e.path)).toEqual(entries2.map((e) => e.path));
      for (let i = 0; i < entries1.length; i++) {
        expect(entries1[i].content).toEqual(entries2[i].content);
      }
    });

    it('should handle binary (Uint8Array) content', async () => {
      const binaryTree: FileTree = {
        'data.bin': new Uint8Array([0x00, 0x01, 0x02, 0xff]),
        'text.txt': 'hello',
      };

      const result = await generateZipFromFileTree(binaryTree, 'bin-project');
      const entries = await extractFilesFromZip(result.data);

      expect(entries).toHaveLength(2);
    });

    it('should handle an empty FileTree', async () => {
      const result = await generateZipFromFileTree({}, 'empty-project');
      const entries = await extractFilesFromZip(result.data);

      expect(entries).toHaveLength(0);
    });

    it('should call progress callback during generation', async () => {
      const onProgress: ProgressCallback = vi.fn();

      await generateZipFromFileTree(sampleTree, 'test-project', { onProgress });

      expect(onProgress).toHaveBeenCalled();
      const calls = (onProgress as ReturnType<typeof vi.fn>).mock.calls;
      for (const [event] of calls) {
        expect(event.phase).toBe(CoreProgressPhase.packaging);
        expect(event).toHaveProperty('percentage');
        expect(event.percentage).toBeGreaterThanOrEqual(0);
        expect(event.percentage).toBeLessThanOrEqual(100);
      }
    });

    it('should emit file progress in sorted path order for deterministic packaging', async () => {
      const unsortedTree: FileTree = {
        'src/main.rs': '#![no_std]\nfn main() {}',
        'README.md': '# Test Project',
        'Cargo.toml': '[package]\nname = "test"',
      };
      const onProgress: ProgressCallback = vi.fn();

      await generateZipFromFileTree(unsortedTree, 'test-project', { onProgress });

      const calls = (onProgress as ReturnType<typeof vi.fn>).mock.calls;
      const addedMessages = calls
        .map(([event]) => event.message)
        .filter((message): message is string => typeof message === 'string' && message.startsWith('Added '));

      expect(addedMessages).toEqual([
        'Added Cargo.toml',
        'Added README.md',
        'Added src/main.rs',
      ]);
    });

    it('should not throw when no progress callback is provided', async () => {
      await expect(generateZipFromFileTree(sampleTree, 'test-project')).resolves.not.toThrow();
    });

    it('should reject unsafe project names that could escape the archive root', async () => {
      await expect(generateZipFromFileTree(sampleTree, '../evil')).rejects.toThrow(/unsafe/);
      await expect(generateZipFromFileTree(sampleTree, 'a/b')).rejects.toThrow(/unsafe/);
    });

    it('should reject unsafe FileTree paths (zip-slip)', async () => {
      await expect(
        generateZipFromFileTree({ '../outside.txt': 'x' }, 'proj')
      ).rejects.toThrow(/\.\./);
      await expect(
        generateZipFromFileTree({ '/abs.txt': 'x' }, 'proj')
      ).rejects.toThrow(/relative/);
      await expect(
        generateZipFromFileTree({ 'a\\win.txt': 'x' }, 'proj')
      ).rejects.toThrow(/forward slashes/);
    });
  });
});
