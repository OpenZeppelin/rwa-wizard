/**
 * Triggers a browser download of a Blob with the given file name.
 * Used for ZIP handoff after codegen (contract: primary outcome is downloadable ZIP).
 */
export function downloadZip(fileName: string, data: Blob): void {
  const url = URL.createObjectURL(data);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}
