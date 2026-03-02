import { describe, expect, it } from 'vitest';

import {
  addFile,
  createFile,
  getFileCount,
  getFilePaths,
  mergeFileTrees,
  prefixPaths,
} from '../src/file-tree';
import type { FileTree } from '../src/types';

describe('File Tree Builder', () => {
  describe('createFile', () => {
    it('should create a FileTree with a single string entry', () => {
      const tree = createFile('src/main.rs', 'fn main() {}');

      expect(Object.keys(tree)).toHaveLength(1);
      expect(tree['src/main.rs']).toBe('fn main() {}');
    });

    it('should create a FileTree with a Uint8Array entry', () => {
      const content = new Uint8Array([0x00, 0x01, 0x02]);
      const tree = createFile('data.bin', content);

      expect(tree['data.bin']).toBeInstanceOf(Uint8Array);
      expect(tree['data.bin']).toEqual(content);
    });

    it('should create a FileTree with an empty string', () => {
      const tree = createFile('empty.txt', '');

      expect(tree['empty.txt']).toBe('');
    });

    it('should handle deeply nested paths', () => {
      const tree = createFile('a/b/c/d/e/f.txt', 'deep');

      expect(tree['a/b/c/d/e/f.txt']).toBe('deep');
    });
  });

  describe('mergeFileTrees', () => {
    it('should merge two non-overlapping trees', () => {
      const a = createFile('a.txt', 'A');
      const b = createFile('b.txt', 'B');
      const merged = mergeFileTrees(a, b);

      expect(Object.keys(merged)).toHaveLength(2);
      expect(merged['a.txt']).toBe('A');
      expect(merged['b.txt']).toBe('B');
    });

    it('should let later trees override earlier ones for the same path', () => {
      const original = createFile('config.toml', 'old');
      const updated = createFile('config.toml', 'new');
      const merged = mergeFileTrees(original, updated);

      expect(Object.keys(merged)).toHaveLength(1);
      expect(merged['config.toml']).toBe('new');
    });

    it('should merge multiple trees at once', () => {
      const a: FileTree = { 'a.txt': 'A' };
      const b: FileTree = { 'b.txt': 'B' };
      const c: FileTree = { 'c.txt': 'C' };
      const merged = mergeFileTrees(a, b, c);

      expect(Object.keys(merged)).toHaveLength(3);
    });

    it('should return an empty tree when merging no arguments', () => {
      const merged = mergeFileTrees();

      expect(Object.keys(merged)).toHaveLength(0);
    });

    it('should return an empty tree when merging empty trees', () => {
      const merged = mergeFileTrees({}, {});

      expect(Object.keys(merged)).toHaveLength(0);
    });

    it('should not mutate input trees', () => {
      const a: FileTree = { 'a.txt': 'A' };
      const b: FileTree = { 'b.txt': 'B' };

      mergeFileTrees(a, b);

      expect(Object.keys(a)).toHaveLength(1);
      expect(Object.keys(b)).toHaveLength(1);
    });
  });

  describe('addFile', () => {
    it('should add a file to an existing tree', () => {
      const tree = createFile('a.txt', 'A');
      const result = addFile(tree, 'b.txt', 'B');

      expect(Object.keys(result)).toHaveLength(2);
      expect(result['a.txt']).toBe('A');
      expect(result['b.txt']).toBe('B');
    });

    it('should override an existing path', () => {
      const tree = createFile('a.txt', 'old');
      const result = addFile(tree, 'a.txt', 'new');

      expect(Object.keys(result)).toHaveLength(1);
      expect(result['a.txt']).toBe('new');
    });

    it('should not mutate the original tree', () => {
      const tree = createFile('a.txt', 'A');
      addFile(tree, 'b.txt', 'B');

      expect(Object.keys(tree)).toHaveLength(1);
      expect(tree['b.txt']).toBeUndefined();
    });

    it('should handle Uint8Array content', () => {
      const tree = createFile('text.txt', 'hello');
      const bin = new Uint8Array([0xff]);
      const result = addFile(tree, 'binary.bin', bin);

      expect(result['binary.bin']).toEqual(bin);
    });
  });

  describe('prefixPaths', () => {
    it('should prefix all paths with a directory name', () => {
      const tree: FileTree = {
        'src/main.rs': 'code',
        'Cargo.toml': 'manifest',
      };
      const prefixed = prefixPaths(tree, 'my-project');

      expect(prefixed['my-project/src/main.rs']).toBe('code');
      expect(prefixed['my-project/Cargo.toml']).toBe('manifest');
    });

    it('should handle a trailing slash in the prefix', () => {
      const tree = createFile('a.txt', 'A');
      const prefixed = prefixPaths(tree, 'root/');

      expect(prefixed['root/a.txt']).toBe('A');
    });

    it('should not double-slash when prefix has trailing slash', () => {
      const tree = createFile('file.txt', 'content');
      const prefixed = prefixPaths(tree, 'dir/');

      const paths = Object.keys(prefixed);
      expect(paths[0]).toBe('dir/file.txt');
      expect(paths[0]).not.toContain('//');
    });

    it('should not mutate the original tree', () => {
      const tree = createFile('a.txt', 'A');
      prefixPaths(tree, 'prefix');

      expect(tree['a.txt']).toBe('A');
      expect(tree['prefix/a.txt']).toBeUndefined();
    });

    it('should handle an empty tree', () => {
      const prefixed = prefixPaths({}, 'root');

      expect(Object.keys(prefixed)).toHaveLength(0);
    });

    it('should handle nested prefix paths', () => {
      const tree = createFile('file.rs', 'content');
      const prefixed = prefixPaths(tree, 'contracts/token/src');

      expect(prefixed['contracts/token/src/file.rs']).toBe('content');
    });
  });

  describe('getFilePaths', () => {
    it('should return sorted file paths', () => {
      const tree: FileTree = {
        'z.txt': 'Z',
        'a.txt': 'A',
        'm.txt': 'M',
      };
      const paths = getFilePaths(tree);

      expect(paths).toEqual(['a.txt', 'm.txt', 'z.txt']);
    });

    it('should sort nested paths correctly', () => {
      const tree: FileTree = {
        'src/b.rs': '',
        'Cargo.toml': '',
        'src/a.rs': '',
        'README.md': '',
      };
      const paths = getFilePaths(tree);

      expect(paths).toEqual(['Cargo.toml', 'README.md', 'src/a.rs', 'src/b.rs']);
    });

    it('should return an empty array for an empty tree', () => {
      expect(getFilePaths({})).toEqual([]);
    });
  });

  describe('getFileCount', () => {
    it('should count files accurately', () => {
      const tree: FileTree = {
        'a.txt': 'A',
        'b.txt': 'B',
        'c.txt': 'C',
      };
      expect(getFileCount(tree)).toBe(3);
    });

    it('should return 0 for an empty tree', () => {
      expect(getFileCount({})).toBe(0);
    });

    it('should count single-file trees', () => {
      expect(getFileCount(createFile('only.txt', 'content'))).toBe(1);
    });
  });
});
