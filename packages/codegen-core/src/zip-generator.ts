import JSZip from 'jszip';

import { createProgressEvent, resolveProgressCallback } from './progress';
import { CoreProgressPhase } from './progress-phases';
import type { FileTree, ProgressCallback } from './types';

export interface ZipOptions {
  onProgress?: ProgressCallback;
}

export interface ZipOutput {
  data: Blob;
  fileName: string;
}

function assertSafeZipProjectName(projectName: string): string {
  const base = projectName.endsWith('.zip') ? projectName.slice(0, -4) : projectName;
  if (!base || base.includes('\0')) {
    throw new Error('ZIP project name must be a non-empty string without null bytes');
  }
  if (base.includes('..') || base.includes('/') || base.includes('\\')) {
    throw new Error(`ZIP project name contains unsafe path segments: ${JSON.stringify(base)}`);
  }
  return base;
}

function assertSafeZipRelativePath(relativePath: string): void {
  if (relativePath.includes('\0')) {
    throw new Error('FileTree path must not contain null bytes');
  }
  if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
    throw new Error(`FileTree path must be relative: ${JSON.stringify(relativePath)}`);
  }
  if (relativePath.includes('\\')) {
    throw new Error(`FileTree path must use forward slashes only: ${JSON.stringify(relativePath)}`);
  }
  for (const segment of relativePath.split('/')) {
    if (segment === '..') {
      throw new Error(`FileTree path must not contain "..": ${JSON.stringify(relativePath)}`);
    }
  }
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

  progress(createProgressEvent(CoreProgressPhase.packaging, 0, 'Starting ZIP assembly'));

  const entries = Object.entries(fileTree).sort(([leftPath], [rightPath]) => {
    if (leftPath < rightPath) return -1;
    if (leftPath > rightPath) return 1;
    return 0;
  });
  const rootDir = assertSafeZipProjectName(projectName);
  const fileName = rootDir.endsWith('.zip') ? rootDir : `${rootDir}.zip`;

  for (let i = 0; i < entries.length; i++) {
    const [path, content] = entries[i];
    assertSafeZipRelativePath(path);
    const fullPath = `${rootDir}/${path}`;

    if (content instanceof Uint8Array) {
      zip.file(fullPath, content);
    } else {
      zip.file(fullPath, content);
    }

    const percentage = Math.round(((i + 1) / entries.length) * 80);
    progress(createProgressEvent(CoreProgressPhase.packaging, percentage, `Added ${path}`));
  }

  progress(createProgressEvent(CoreProgressPhase.packaging, 80, 'Compressing'));

  const blob = await zip.generateAsync({ type: 'blob' });

  progress(createProgressEvent(CoreProgressPhase.packaging, 100, 'ZIP assembly complete'));

  return { data: blob, fileName };
}
