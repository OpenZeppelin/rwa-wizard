/**
 * Prepend a Rust comment banner to a source file.
 */
export function prependRustCommentBanner(source: string, lines: string[]): string {
  if (lines.length === 0) return source;
  return `${lines.map((line) => `// ${line}`).join('\n')}\n\n${source}`;
}
