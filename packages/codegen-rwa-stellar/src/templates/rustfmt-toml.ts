/**
 * Generates the `rustfmt.toml` config file for the generated project.
 *
 * This ensures `cargo fmt` produces consistent output regardless of the
 * user's local rustfmt settings. The generator emits readable but not
 * canonically formatted Rust — users run `cargo fmt` post-generation.
 */
export function generateRustfmtToml(): string {
  return `edition = "2021"
max_width = 100
use_small_heuristics = "Default"
`;
}
