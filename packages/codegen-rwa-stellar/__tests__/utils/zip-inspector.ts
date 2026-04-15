import JSZip from 'jszip';

export interface ZipEntry {
  path: string;
  content: string;
}

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

export function validateProjectStructure(
  actual: ZipEntry[],
  expectedPaths: string[]
): { missing: string[]; unexpected: string[] } {
  const actualPaths = new Set(actual.map((entry) => entry.path));
  const expected = new Set(expectedPaths);

  const missing = expectedPaths.filter((path) => !actualPaths.has(path));
  const unexpected = actual.map((entry) => entry.path).filter((path) => !expected.has(path));

  return { missing, unexpected };
}

export function findFileContent(entries: ZipEntry[], path: string): string | undefined {
  return entries.find((entry) => entry.path === path)?.content;
}
