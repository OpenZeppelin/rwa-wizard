import type { ConfigPath } from '../../wizard/config-path';

/**
 * Every input the column's subject is a function of. **Five**, enumerated so the
 * standing one-test-per-input rule has something to enumerate against.
 *
 * `livePath` rather than the design's separate `liveResolves` boolean: the two
 * carried the same fact, and the third clause below needs the path itself, not
 * merely whether there was one.
 */
export interface ImpactSubjectInput {
  /** The inspected anchor, resolved through `anchorToConfigPath` and existence-checked. */
  readonly inspectedPath: ConfigPath | null;
  /** SF-12's answer for whatever holds focus right now. */
  readonly livePath: ConfigPath | null;
  /** SF-12's `hasFocusedElement`: a live, connected, non-`body` element holds focus. */
  readonly liveHasFocus: boolean;
  /**
   * SF-13/SF-14 reach: the user is pointing at or focused inside the column, or
   * focused inside the drawer's preview chrome (code pane / tree / sheet tools /
   * portaled dock menu — same hole).
   * The caller ORs those; this function stays pure over five plain values.
   */
  readonly columnHasFocus: boolean;
  /**
   * The answer the column was rendering when the user reached into it, or `null`.
   *
   * Captured by the latch's own arm handlers (and the remembered-answer effect)
   * and already staleness-checked by the caller, so this function stays pure
   * over five plain values. Consulted **only** by clause 4 and only while
   * `columnHasFocus` — outside that window the caller passes `null` and the
   * rule is exactly the four-input rule it was.
   */
  readonly heldAnswer: ConfigPath | null;
}

/**
 * Which config path the column describes, as a pure function of four inputs.
 *
 * Three clauses, in this order, and the order is load-bearing:
 *
 *  1. **A live control that writes nothing, with focus outside the reach, wins
 *     over the subject → `null`.** The Review step's `include-identity-support`
 *     demonstrably changes the generated tree and still resolves to no
 *     `RWAConfig` location, and the app owes the user that true statement rather
 *     than a sticky older answer. Restricted to focus *outside* the column (and
 *     the preview chrome the caller folds into `columnHasFocus`) because a
 *     control inside the column — or the code pane — also writes nothing, and
 *     clearing there would break the latch / wipe a resolvable inspected subject.
 *  2. **Otherwise the subject, whatever focus is doing.** This is the whole
 *     point of the unit, and it covers both cases it exists for with one clause:
 *     focus landed nowhere after an add, and focus moved into the column.
 *  3. **Otherwise live focus's own answer**, which may itself be `null`.
 *
 * **Clause 4 — the reach keeps the last rendered answer.** Added after the
 * layout probe caught a real regression of AS-3 that no browser-free test could
 * see, because it is a *missing* case rather than a wrong one: for a location
 * that resolves but does not exist yet, reaching into the column nulls
 * `livePath` (focus moved) while `inspectedPath` was already null (the item does
 * not exist), so clauses 2 and 3 both have nothing and the column announces
 * `not-a-field` about a control that plainly writes config. This restores
 * exactly what SF-13's held latch did, so there is no new behaviour to defend.
 *
 * The alternative — having `useInspectedConfigPath` yield the pending path — was
 * rejected: a pending slot names a *different, later* item and renders as a
 * confident populated answer, which is the failure INV-10 calls Critical and the
 * class of output this initiative was restarted to eliminate. The honest fix is
 * a fifth `FieldImpactView` kind for "resolves but does not exist yet"; that is
 * SF-13's surface plus a copy key, and it has now been wanted **twice**. If a
 * third case appears it stops being a refinement and becomes the fix.
 *
 * Clause 3 is why this sub-feature changes no behaviour for a control with
 * nothing inspected — including the two states where the design's rule, which
 * returned `null` whenever the subject was null, produced a **false** statement.
 * With `hasFocusedElement` true and a null path the column renders
 * `not-a-field` — *"this control affects no generated code"* — and it would have
 * said that about the Claim Issuer Contract Address input, which resolves to
 * `identityVerification.trustedIssuers[n]`, and about a control that plainly
 * writes `identityVerification.claimTopics` after a predefined pill is
 * deselected. Falling back to `livePath` restores today's answer exactly.
 * INV-22.
 *
 * The genuinely better answer for a pending slot — a location that resolves but
 * does not exist yet — needs a view state that does not exist. `empty` claims no
 * generated file depends on the field, which is false; `pending` means the tree
 * is mid-rebuild, which is a different fact. Adding one is a `FieldImpactView`
 * kind, a `never`-arm, a column branch and a new copy key. Out of scope here,
 * deliberately.
 *
 * `hasFocusedElement` is **not** derived from the subject and is passed to
 * `toFieldImpactView` unchanged. A subject with no live focus is honest about
 * both facts; inventing focus to make the view look right would also make
 * `not-a-field` unreachable. INV-31.
 */
export function resolveImpactSubject(input: ImpactSubjectInput): ConfigPath | null {
  const { inspectedPath, livePath, liveHasFocus, columnHasFocus, heldAnswer } = input;

  if (liveHasFocus && livePath === null && !columnHasFocus) return null;

  const answer = inspectedPath ?? livePath;
  if (answer !== null) return answer;

  // Clause 4. Both live sources went quiet *because* the user reached into the
  // column, so the column must keep saying what it was saying. Without this a
  // pending location — an operator role with no addresses, a pending trusted
  // issuer, a deselected predefined topic — renders `not-a-field` the moment it
  // is reached for: clause 3 loses `livePath` to the reach, and clause 2 never
  // had a subject because `anchorItemExists` refuses a location that does not
  // exist yet. See the note above on why yielding the pending path instead is
  // not available.
  return columnHasFocus ? heldAnswer : null;
}
