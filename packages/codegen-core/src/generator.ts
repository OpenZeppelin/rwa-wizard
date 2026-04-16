import { createProgressEvent, resolveProgressCallback } from './progress';
import { CoreProgressPhase } from './progress-phases';
import type { GenerationResult, ProgressCallback, ZipResult } from './types';
import { generateZipFromFileTree } from './zip-generator';

/**
 * Package a GenerationResult into a ZIP archive.
 *
 * This is a standalone function (not on Generator) because ZIP assembly
 * is a cross-cutting concern owned by the core engine, not by generators.
 *
 * @param result - The generation result containing the file tree and metadata.
 * @param fileName - The base name for the ZIP archive (and root directory).
 * @param options - Optional progress callback.
 * @returns A ZipResult containing the ZIP blob, file name, and metadata.
 */
export async function generateZip(
  result: GenerationResult,
  fileName: string,
  options?: { onProgress?: ProgressCallback }
): Promise<ZipResult> {
  const progress = resolveProgressCallback(options?.onProgress);

  progress(createProgressEvent(CoreProgressPhase.packaging, 0, 'Starting ZIP packaging'));

  const zipOutput = await generateZipFromFileTree(result.files, fileName, {
    onProgress: options?.onProgress,
  });

  progress(createProgressEvent(CoreProgressPhase.packaging, 100, 'ZIP packaging complete'));

  return {
    data: zipOutput.data,
    fileName: zipOutput.fileName,
    metadata: result.metadata,
  };
}
