import JSZip from 'jszip';

import { createProgressEvent, resolveProgressCallback } from './progress';
import type { FileTree, ProgressCallback } from './types';

export interface ZipOptions {
  onProgress?: ProgressCallback;
}

export interface ZipOutput {
  data: Blob;
  fileName: string;
}

/**
 * Generate a ZIP archive from a FileTree.
 *
 * Files are placed under a root directory named after `projectName`.
 * The output is content-deterministic: identical FileTrees produce
 * identical file names and contents (byte-level identity of the archive
 * is not guaranteed due to compression metadata).
 */
export async function generateZipFromFileTree(
  fileTree: FileTree,
  projectName: string,
  options?: ZipOptions
): Promise<ZipOutput> {
  const progress = resolveProgressCallback(options?.onProgress);
  const zip = new JSZip();

  progress(createProgressEvent('assembling-zip', 0, 'Starting ZIP assembly'));

  const entries = Object.entries(fileTree);
  const rootDir = projectName.endsWith('.zip') ? projectName.slice(0, -4) : projectName;
  const fileName = rootDir.endsWith('.zip') ? rootDir : `${rootDir}.zip`;

  for (let i = 0; i < entries.length; i++) {
    const [path, content] = entries[i];
    const fullPath = `${rootDir}/${path}`;

    if (content instanceof Uint8Array) {
      zip.file(fullPath, content);
    } else {
      zip.file(fullPath, content);
    }

    const percentage = Math.round(((i + 1) / entries.length) * 80);
    progress(createProgressEvent('assembling-zip', percentage, `Added ${path}`));
  }

  progress(createProgressEvent('assembling-zip', 80, 'Compressing'));

  const blob = await zip.generateAsync({ type: 'blob' });

  progress(createProgressEvent('assembling-zip', 100, 'ZIP assembly complete'));

  return { data: blob, fileName };
}
