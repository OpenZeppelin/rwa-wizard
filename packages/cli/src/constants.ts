/** Commander/help text for flags that stay chain-agnostic at the CLI boundary. */
export const INCLUDE_IDENTITY_SUPPORT_FLAG_DESCRIPTION =
  'Include optional dev/testnet identity-onboarding scaffolding when supported by the selected chain generator (not for production)';

export const UNSUPPORTED_IDENTITY_SUPPORT_MESSAGE =
  'The selected chain generator does not support optional identity-onboarding artifacts';

/** Shown when --include-identity-support is requested before generation starts. */
export const INCLUDE_IDENTITY_SUPPORT_WARNING =
  '--include-identity-support adds example onboarding scaffolding for local and testnet demos. It is not a production identity stack.';
