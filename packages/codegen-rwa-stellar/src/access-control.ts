/**
 * Convert a role symbol into a valid Rust identifier for generated code.
 */
export function roleSymbolToRustIdentifier(symbol: string): string {
  const sanitized = symbol.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z_]/.test(sanitized) ? sanitized : `role_${sanitized}`;
}
