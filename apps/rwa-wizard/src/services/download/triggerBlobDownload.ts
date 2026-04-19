/**
 * Triggers a browser download of a Blob with the given file name.
 *
 * We revoke the object URL on the next tick rather than immediately so the
 * browser has a chance to start the download — some engines race the revoke
 * against the anchor click and drop the download entirely.
 */
export function triggerBlobDownload(fileName: string, data: Blob): void {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer the revoke so the browser has committed the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
