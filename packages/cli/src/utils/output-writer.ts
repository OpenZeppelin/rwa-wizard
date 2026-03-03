import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { GenerationResult, ZipResult } from '@openzeppelin/codegen-core';

import { logger } from './logger';

export interface WriteResult {
  outputPath: string;
  fileCount: number;
  isZip: boolean;
}

export function writeFileTree(result: GenerationResult, outputDir: string): WriteResult {
  const absoluteOut = resolve(outputDir);
  let fileCount = 0;

  for (const [filePath, content] of Object.entries(result.files)) {
    const fullPath = join(absoluteOut, filePath);
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

export async function writeZip(zipResult: ZipResult, outputPath: string): Promise<WriteResult> {
  const absoluteOut = resolve(outputPath);
  mkdirSync(dirname(absoluteOut), { recursive: true });

  const arrayBuf = await zipResult.data.arrayBuffer();
  writeFileSync(absoluteOut, Buffer.from(arrayBuf));

  return { outputPath: absoluteOut, fileCount: zipResult.metadata.fileCount, isZip: true };
}
