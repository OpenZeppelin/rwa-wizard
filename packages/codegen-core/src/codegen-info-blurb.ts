/**
 * Structured informational content about a codegen target (ecosystem docs, upstream
 * repositories, protocol references). UIs can render it as a callout; CLIs can print it
 * as a preamble or help text — the shape is presentation-agnostic.
 */

/** One labeled outbound reference (repository, SEP, EIP, etc.). */
export interface CodegenInfoLink {
  label: string;
  href: string;
}

/** Title, body, and reference links for introductory copy tied to a generator. */
export interface CodegenInfoBlurb {
  title: string;
  description: string;
  links: CodegenInfoLink[];
}
