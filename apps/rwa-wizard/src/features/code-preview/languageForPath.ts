import type { CodeViewLanguage } from '@openzeppelin/ui-components/code-view';

const EXTENSION_LANGUAGE: Readonly<Record<string, CodeViewLanguage>> = {
  rs: 'rust',
  toml: 'toml',
  sh: 'shell',
  json: 'json',
  md: 'markdown',
};

/** Maps generated paths to CodeView languages. No content sniffing. INV-19 */
export function languageForPath(path: string): CodeViewLanguage {
  const dot = path.lastIndexOf('.');
  if (dot < 0) {
    return 'plaintext';
  }

  const extension = path.slice(dot + 1).toLowerCase();
  return EXTENSION_LANGUAGE[extension] ?? 'plaintext';
}
