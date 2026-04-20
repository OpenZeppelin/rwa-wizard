/**
 * Generates the standard `lib.rs` file content for each generated contract crate.
 * Follows the Soroban crate convention: `#![no_std]`, module declaration, re-export.
 */
export function generateLibRs(): string {
  return `#![no_std]

mod contract;
pub use contract::*;
`;
}
