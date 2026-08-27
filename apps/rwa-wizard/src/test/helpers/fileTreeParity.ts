import JSZip from 'jszip';

import type { FileTree } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { RwaCodegenService } from '../../services/codegen/types';

/** INV-6 mixed-type compare: strings as UTF-8 text; Uint8Array by bytes. */
export function fileContentsEqual(left: string | Uint8Array, right: string | Uint8Array): boolean {
  if (typeof left === 'string' && typeof right === 'string') {
    return left === right;
  }
  const leftBytes = typeof left === 'string' ? new TextEncoder().encode(left) : left;
  const rightBytes = typeof right === 'string' ? new TextEncoder().encode(right) : right;
  if (leftBytes.length !== rightBytes.length) return false;
  for (let i = 0; i < leftBytes.length; i++) {
    if (leftBytes[i] !== rightBytes[i]) return false;
  }
  return true;
}

export function sortedKeys(files: FileTree): string[] {
  return Object.keys(files).sort();
}

/**
 * Unzip a download Blob and drop exactly one leading path segment (the
 * packaging root named from the token symbol). Directory entries are skipped.
 */
export async function unzipStrippingOneRoot(data: Blob): Promise<{
  files: FileTree;
  outsideRoot: string[];
}> {
  const zip = await JSZip.loadAsync(await data.arrayBuffer());
  const files: FileTree = {};
  const outsideRoot: string[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const slash = path.indexOf('/');
    if (slash <= 0) {
      outsideRoot.push(path);
      continue;
    }
    const relative = path.slice(slash + 1);
    files[relative] = await entry.async('uint8array');
  }

  return { files, outsideRoot };
}

export async function assertTreeMatchesZip(
  service: RwaCodegenService,
  config: RWAConfig,
  includeIdentitySupport: boolean
): Promise<void> {
  const { files: tree } = await service.generateFileTree(config, { includeIdentitySupport });
  const zip = await service.generateZip(config, { includeIdentitySupport });
  const { files: unzipped, outsideRoot } = await unzipStrippingOneRoot(zip.data);

  const treeKeys = sortedKeys(tree);
  const zipKeys = sortedKeys(unzipped);

  if (outsideRoot.length > 0) {
    throw new Error(`INV-6: ZIP has files outside a single root folder: ${outsideRoot.join(', ')}`);
  }
  if (treeKeys.length !== zipKeys.length || treeKeys.some((key, i) => key !== zipKeys[i])) {
    throw new Error(
      `INV-6: tree keys !== ZIP keys (after one root strip).\n` +
        `tree (${treeKeys.length}): ${treeKeys.join(', ')}\n` +
        `zip  (${zipKeys.length}): ${zipKeys.join(', ')}`
    );
  }
  for (const path of treeKeys) {
    const treeValue = tree[path];
    const zipValue = unzipped[path];
    if (treeValue === undefined || zipValue === undefined) {
      throw new Error(`INV-6: missing contents for ${path}`);
    }
    if (!fileContentsEqual(treeValue, zipValue)) {
      throw new Error(`INV-6: content mismatch at ${path}`);
    }
  }
}
