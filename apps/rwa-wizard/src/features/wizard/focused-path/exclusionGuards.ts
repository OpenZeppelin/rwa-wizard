import type { IdentityVerificationConfig } from '@openzeppelin/rwa-config';

/**
 * Type-level guards for controls that are deliberately left unanchored.
 *
 * These live in source rather than in a test file on purpose: `pnpm typecheck`
 * is the gate the invariant names, and a guard that only exists inside a test
 * can be deleted with the test. Nothing imports this module at runtime — it is
 * compiled, not executed.
 */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Expect<T extends true> = T;

/**
 * `ImplementationApproach`'s `SelectableCard` is the one exclusion that could
 * plausibly have been anchored and was not: it renders the single supported
 * verification approach, permanently selected, with `onClick={() => {}}`, and
 * `IdentityVerificationConfig` has no member it could write.
 *
 * The guard is at the **type** level rather than a line in the exclusion list,
 * because the list version does not actually guard anything. A second approach
 * card would resolve to `null` exactly like the first, fail the coverage
 * partition once, and be cleared by adding one more exclusion line — a speed
 * bump a hurried dev clears without noticing that the control now writes config.
 * This assertion cannot be satisfied by editing a list: `RWAConfig` must gain a
 * member before a second approach can write anything, so the guard is tied to
 * the actual precondition.
 *
 * It fails to compile the day `IdentityVerificationConfig` gains a member — a
 * verification-approach discriminant, say — at which point that card becomes a
 * real choice and must be anchored rather than excluded. INV-12.
 */
export type ImplementationApproachExclusionStillValid = Expect<
  Equal<keyof IdentityVerificationConfig, 'claimTopics' | 'trustedIssuers' | 'controls'>
>;
