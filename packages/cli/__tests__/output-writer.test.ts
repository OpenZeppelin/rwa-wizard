import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeFileTree, writeZip } from '../src/utils/output-writer';

vi.mock('../src/utils/logger', () => ({
  logger: { fileWritten: vi.fn() },
}));

describe('writeFileTree', () => {
  const tmpDir = join(tmpdir(), `cli-test-filetree-${Date.now()}`);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write string files to output directory', () => {
    const result = writeFileTree(
      {
        files: { 'src/main.rs': 'fn main() {}', 'Cargo.toml': '[package]' },
        metadata: {
          generatorName: 't',
          generatorVersion: '0',
          generatedAt: '',
          fileCount: 2,
          configHash: 'x',
        },
      },
      tmpDir
    );

    expect(result.fileCount).toBe(2);
    expect(result.isZip).toBe(false);
    expect(readFileSync(join(tmpDir, 'src/main.rs'), 'utf-8')).toBe('fn main() {}');
    expect(readFileSync(join(tmpDir, 'Cargo.toml'), 'utf-8')).toBe('[package]');
  });

  it('should write binary (Uint8Array) files', () => {
    const binary = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    writeFileTree(
      {
        files: { 'data.bin': binary },
        metadata: {
          generatorName: 't',
          generatorVersion: '0',
          generatedAt: '',
          fileCount: 1,
          configHash: 'x',
        },
      },
      tmpDir
    );

    const content = readFileSync(join(tmpDir, 'data.bin'));
    expect(content[0]).toBe(0xde);
    expect(content[3]).toBe(0xef);
  });

  it('should create deeply nested directories', () => {
    writeFileTree(
      {
        files: { 'a/b/c/d/deep.txt': 'deep' },
        metadata: {
          generatorName: 't',
          generatorVersion: '0',
          generatedAt: '',
          fileCount: 1,
          configHash: 'x',
        },
      },
      tmpDir
    );

    expect(existsSync(join(tmpDir, 'a/b/c/d/deep.txt'))).toBe(true);
  });

  it('should return the resolved absolute output path', () => {
    const result = writeFileTree(
      {
        files: { 'f.txt': 'x' },
        metadata: {
          generatorName: 't',
          generatorVersion: '0',
          generatedAt: '',
          fileCount: 1,
          configHash: 'x',
        },
      },
      tmpDir
    );

    expect(result.outputPath).toBe(resolve(tmpDir));
  });

  it('should handle an empty file tree', () => {
    const result = writeFileTree(
      {
        files: {},
        metadata: {
          generatorName: 't',
          generatorVersion: '0',
          generatedAt: '',
          fileCount: 0,
          configHash: 'x',
        },
      },
      tmpDir
    );

    expect(result.fileCount).toBe(0);
  });

  it('should refuse to write paths that escape outputDir via ..', () => {
    expect(() =>
      writeFileTree(
        {
          files: { '../escaped.txt': 'bad' },
          metadata: {
            generatorName: 't',
            generatorVersion: '0',
            generatedAt: '',
            fileCount: 1,
            configHash: 'x',
          },
        },
        tmpDir
      )
    ).toThrow(/outside output directory/);
  });

  it('should refuse to write through a symlink directory inside the output tree', () => {
    const outside = join(tmpdir(), `cli-outside-${Date.now()}`);
    const linkName = join(tmpDir, 'linkdir');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, linkName, 'dir');

    expect(() =>
      writeFileTree(
        {
          files: { 'linkdir/x.txt': 'x' },
          metadata: {
            generatorName: 't',
            generatorVersion: '0',
            generatedAt: '',
            fileCount: 1,
            configHash: 'x',
          },
        },
        tmpDir
      )
    ).toThrow(/symbolic link/);
  });

  it('should allow filenames beginning with .. when they stay inside the output directory', () => {
    writeFileTree(
      {
        files: { '..suffix.txt': 'ok' },
        metadata: {
          generatorName: 't',
          generatorVersion: '0',
          generatedAt: '',
          fileCount: 1,
          configHash: 'x',
        },
      },
      tmpDir
    );

    expect(readFileSync(join(tmpDir, '..suffix.txt'), 'utf-8')).toBe('ok');
  });

  it('should refuse absolute file paths from generators', () => {
    expect(() =>
      writeFileTree(
        {
          files: { '/etc/malicious': 'bad' },
          metadata: {
            generatorName: 't',
            generatorVersion: '0',
            generatedAt: '',
            fileCount: 1,
            configHash: 'x',
          },
        },
        tmpDir
      )
    ).toThrow(/absolute path/);
  });
});

describe('writeZip', () => {
  const tmpDir = join(tmpdir(), `cli-test-zip-${Date.now()}`);
  const zipPath = join(tmpDir, 'output.zip');

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write ZIP blob to disk', async () => {
    const result = await writeZip(
      {
        data: new Blob(['fake-zip-data']),
        fileName: 'test.zip',
        metadata: {
          generatorName: 't',
          generatorVersion: '0',
          generatedAt: '',
          fileCount: 3,
          configHash: 'x',
        },
      },
      zipPath
    );

    expect(result.isZip).toBe(true);
    expect(result.fileCount).toBe(3);
    expect(existsSync(zipPath)).toBe(true);
  });

  it('should create parent directories for the ZIP path', async () => {
    const nestedZipPath = join(tmpDir, 'nested', 'dir', 'out.zip');
    await writeZip(
      {
        data: new Blob(['data']),
        fileName: 'out.zip',
        metadata: {
          generatorName: 't',
          generatorVersion: '0',
          generatedAt: '',
          fileCount: 1,
          configHash: 'x',
        },
      },
      nestedZipPath
    );

    expect(existsSync(nestedZipPath)).toBe(true);
  });

  it('should return resolved absolute output path', async () => {
    const result = await writeZip(
      {
        data: new Blob(['data']),
        fileName: 'test.zip',
        metadata: {
          generatorName: 't',
          generatorVersion: '0',
          generatedAt: '',
          fileCount: 1,
          configHash: 'x',
        },
      },
      zipPath
    );

    expect(result.outputPath).toBe(resolve(zipPath));
  });
});
