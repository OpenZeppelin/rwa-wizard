import JSZip from 'jszip';

export interface ZipEntry {
  path: string;
  content: string;
}

/**
 * Extract all text files from a ZIP blob into a flat array of path + content.
 */
export async function extractFilesFromZip(data: Blob): Promise<ZipEntry[]> {
  const buffer = await data.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const entries: ZipEntry[] = [];
  const paths = Object.keys(zip.files).sort();

  for (const path of paths) {
    const file = zip.files[path];
    if (file.dir) continue;
    const content = await file.async('string');
    entries.push({ path, content });
  }

  return entries;
}

/**
 * Validate that a ZIP contains exactly the expected set of file paths.
 * Returns a list of differences: missing or unexpected files.
 */
export function validateProjectStructure(
  actual: ZipEntry[],
  expectedPaths: string[]
): { missing: string[]; unexpected: string[] } {
  const actualPaths = new Set(actual.map((e) => e.path));
  const expected = new Set(expectedPaths);

  const missing = expectedPaths.filter((p) => !actualPaths.has(p));
  const unexpected = actual.map((e) => e.path).filter((p) => !expected.has(p));

  return { missing, unexpected };
}

/**
 * Find a specific file in the extracted entries and return its content.
 */
export function findFileContent(entries: ZipEntry[], path: string): string | undefined {
  return entries.find((e) => e.path === path)?.content;
}
