import { triggerBlobDownload } from './triggerBlobDownload';

/**
 * Triggers a browser download of a Blob with the given file name.
 * Used for ZIP handoff after codegen (contract: primary outcome is downloadable ZIP).
 */
export function downloadZip(fileName: string, data: Blob): void {
  triggerBlobDownload(fileName, data);
}
