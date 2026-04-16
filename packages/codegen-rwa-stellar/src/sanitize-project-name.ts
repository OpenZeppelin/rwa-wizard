/**
 * Normalized token symbol fragment used for ZIP root directory names (before `-rwa`).
 * Must stay in sync with {@link sanitizeDirectoryName}.
 */
export function sanitizeTokenSymbolDirectoryBase(symbol: string): string {
  return symbol
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Sanitize a token symbol into a valid directory name for the ZIP root.
 *
 * Algorithm: lowercase → replace non-alphanumeric with hyphens →
 * collapse consecutive hyphens → trim leading/trailing hyphens → append `-rwa`.
 */
export function sanitizeDirectoryName(symbol: string): string {
  return `${sanitizeTokenSymbolDirectoryBase(symbol)}-rwa`;
}
