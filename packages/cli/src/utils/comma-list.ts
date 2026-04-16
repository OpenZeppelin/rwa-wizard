/** Split a comma-separated user input into non-empty trimmed tokens. */
export function parseCommaSeparatedList(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
