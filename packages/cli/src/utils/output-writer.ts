import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import type { GenerationResult, ZipResult } from '@openzeppelin/codegen-core';

import { logger } from './logger';

export interface WriteResult {
  outputPath: string;
  fileCount: number;
  isZip: boolean;
}

// Ensure `filePath` stays within `baseDir` after path resolution so a generator
// cannot write outside the user-selected output directory via `..` or absolute paths.
function resolveSafeChildPath(baseDir: string, filePath: string): string {
  if (isAbsolute(filePath)) {
    throw new Error(`Refusing to write absolute path outside output directory: ${filePath}`);
  }

  const fullPath = resolve(baseDir, filePath);
  const rel = relative(baseDir, fullPath);

  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    throw new Error(`Refusing to write path outside output directory: ${filePath}`);
  }

  return fullPath;
}

export function writeFileTree(result: GenerationResult, outputDir: string): WriteResult {
  const absoluteOut = resolve(outputDir);
  let fileCount = 0;

  for (const [filePath, content] of Object.entries(result.files)) {
    const fullPath = resolveSafeChildPath(absoluteOut, filePath);
    mkdirSync(dirname(fullPath), { recursive: true });

    if (typeof content === 'string') {
      writeFileSync(fullPath, content, 'utf-8');
    } else {
      writeFileSync(fullPath, content);
    }

    logger.fileWritten(filePath);
    fileCount++;
  }

  return { outputPath: absoluteOut, fileCount, isZip: false };
}

export interface ZipWriteResult extends WriteResult {
  sizeBytes: number;
}

export async function writeZip(zipResult: ZipResult, outputPath: string): Promise<ZipWriteResult> {
  const absoluteOut = resolve(outputPath);
  mkdirSync(dirname(absoluteOut), { recursive: true });

  const arrayBuf = await zipResult.data.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  writeFileSync(absoluteOut, buffer);

  return {
    outputPath: absoluteOut,
    fileCount: zipResult.metadata.fileCount,
    isZip: true,
    sizeBytes: buffer.byteLength,
  };
}
