/**
 * The human half of the two-key re-baseline (SF-15).
 *
 * A re-baseline is two documents that must agree: this one, hand-written and
 * typed, which names a guarded file and says why its freeze is superseded; and
 * `__fixtures__/stepMarkup.superseded.json`, machine-written, which says what
 * that file now looks like. Neither alone moves the guard — the suite fails on
 * either half missing (INV-1, INV-2).
 *
 * **This module is a document, not logic.** It has zero imports on purpose: it
 * can never fail to load, and it can never develop a cycle with the fingerprint
 * module that imports it. A reviewer reads it top to bottom and nothing in it
 * executes. No memo, no module state, nothing derived at run time.
 *
 * The declarations flow one way only — declaration → record. The supersede
 * script's sole source for every mirrored field is `MARKUP_SUPERSESSIONS`; it
 * never reads a mirrored field out of the JSON and copies it forward, because a
 * record that could be back-filled into a declaration would make the human half
 * optional (INV-2).
 */

/**
 * Whether this entry replaces a fingerprint the baseline already holds, or
 * records one for a guarded file the baseline never had.
 *
 * The distinction is load-bearing rather than cosmetic: `first-record` can only
 * apply to a file absent from the baseline, so it can never be used to launder
 * an existing file's drift, and `replaces-baseline` requires an actual
 * divergence, so it can never be used to widen the hole pre-emptively. The two
 * kinds partition baseline membership with no overlap and no gap — the
 * admissible kind is a fact about the sealed baseline, not the author's choice
 * (INV-5).
 */
export type SupersessionKind = 'replaces-baseline' | 'first-record';

export interface MarkupSupersession {
  /** Repo-relative path, app-root-relative, exactly as the guarded glob expands it. */
  readonly file: string;
  readonly kind: SupersessionKind;
  /** The sub-feature that authorised it. Shape `SF-<n>`; validated, not trusted. */
  readonly authorisedBy: string;
  /**
   * ISO `YYYY-MM-DD` the decision was taken. Validated, not trusted — and the
   * validation is what makes a lexical comparison a date comparison, which is
   * what `STALE_ADOPTION` relies on to price a second adoption at what the first
   * one cost (INV-16).
   */
  readonly decidedOn: string;
  /**
   * Why the freeze is superseded for this file. Prose, for the reader who asks
   * "what changed and why" a year from now (AS-4). Validated for length and for
   * the reflexive placeholders only — forty characters of nonsense passes, and
   * no machine can check that a reason is a good one. The floor stops the empty
   * string; review does the rest (INV-13).
   */
  readonly reason: string;
  /** The components inside the file whose markup changes. Narrows review to the right hunks. */
  readonly components: readonly string[];
  /**
   * Change in this file's anchor occurrences, **as `findAnchorProps` counts
   * them — permitted new props and permitted ids alike**. Not the change in
   * `PERMITTED_NEW_PROPS` occurrences alone: the generator's own enumeration is
   * fourteen of those plus one permitted `id`, and reading this field in the
   * narrower unit is how a correct change ends up bumping
   * `EXPECTED_ANCHOR_PROP_COUNT` inside the test built to prevent exactly that
   * (INV-7).
   *
   * A human's independent claim, checked against the tree by
   * `ANCHOR_DELTA_MISMATCH` and against SF-12's inventory by the suite. Deriving
   * it from the tree would make it self-satisfying.
   */
  readonly anchorDelta: number;
  /** True iff this file had zero anchor props before and has at least one after. */
  readonly introducesFirstAnchor: boolean;
}

/**
 * The superseded files, in the order a reviewer should read them.
 *
 * **SF-15 ships this empty, and that is the point.** Every property the guard
 * claims is provable at the empty declaration — the union equality reduces to
 * the assertion SF-12 already shipped, every file's authority is `'baseline'`,
 * the inventory arithmetic reduces to `15 = 15 + 0` and `10 = 10 + 0`, and the
 * negatives run on synthetic records. Nothing here waits for SF-14 (INV-33).
 *
 * Adding an entry is step 2 of five: change the markup, declare it here, run
 * `pnpm supersede:step-markup`, commit both files together, and move the
 * inventory literals only if the inventory actually moved.
 */
export const MARKUP_SUPERSESSIONS: readonly MarkupSupersession[] = [
  {
    file: 'src/components/shared/TogglePill.tsx',
    kind: 'replaces-baseline',
    authorisedBy: 'SF-17',
    decidedOn: '2026-09-02',
    reason:
      'The chip splits into three affordances: body inspects only, a dedicated selection ' +
      'control toggles ClaimTopic.selected, and × deletes a custom topic. Inspected state ' +
      'stops being gated on selected so an unselected chip can show as inspected. SC-011 ' +
      'is superseded for this file; the other guarded files hold.',
    components: ['TogglePill'],
    anchorDelta: 0,
    introducesFirstAnchor: false,
  },
  {
    file: 'src/components/shared/TopicToggleGroup.tsx',
    kind: 'replaces-baseline',
    authorisedBy: 'SF-17',
    decidedOn: '2026-09-02',
    reason:
      'Predefined and custom claim-topic chips both adopt the three-affordance TogglePill ' +
      'contract; body onClick membership toggles are removed; selection goes through ' +
      'onToggleSelection and isClaimTopicSelected. SC-011 is superseded for this file.',
    components: ['TopicToggleGroup'],
    anchorDelta: 0,
    introducesFirstAnchor: false,
  },
  {
    file: 'src/features/wizard/steps/identity/TrustedIssuersSection.tsx',
    kind: 'replaces-baseline',
    authorisedBy: 'SF-14',
    decidedOn: '2026-09-04',
    reason:
      "The issuer row's `data-config-anchor` moves from its remove button onto the row, " +
      'so a click anywhere in the row resolves outward to the same anchor the remove ' +
      'button resolves to and inspection cannot disagree with removal. The row also ' +
      'gains `aria-current` and a ring class, and the add handler inspects the created ' +
      'issuer. Post-rebase onto main, limit / empty-topic warning banners (AlertTriangle) ' +
      'land in the same file; re-adopt the fingerprint. SC-011 remains superseded.',
    components: ['TrustedIssuersSection', 'IssuerRow'],
    anchorDelta: 0,
    introducesFirstAnchor: false,
  },
  {
    file: 'src/components/shared/SelectableCard.tsx',
    kind: 'replaces-baseline',
    authorisedBy: 'SF-14',
    decidedOn: '2026-09-02',
    reason:
      'Anchored cards wire useIsInspected for the impact column: aria-current and an ' +
      'offset ring on inspection, separate from isSelected border fill. SC-011 is superseded ' +
      'for this file.',
    components: ['SelectableCard'],
    anchorDelta: 0,
    introducesFirstAnchor: false,
  },
  {
    file: 'src/features/wizard/steps/access-control/OperatorRolesSection.tsx',
    kind: 'replaces-baseline',
    authorisedBy: 'SF-14',
    decidedOn: '2026-09-02',
    reason:
      'Each operator role row gains inspected ring and aria-current via useIsInspected so ' +
      'click-to-inspect shows which role drives the impact column. SC-011 is superseded for ' +
      'this file.',
    components: ['OperatorRolesSection', 'OperatorRoleRow'],
    anchorDelta: 0,
    introducesFirstAnchor: false,
  },
  {
    file: 'src/features/wizard/steps/compliance/ModuleConfigPanel.tsx',
    kind: 'replaces-baseline',
    authorisedBy: 'SF-14',
    decidedOn: '2026-09-02',
    reason:
      'Each address-list field is wrapped in a data-field-id root because the published kit no ' +
      'longer renders that attribute from a permitted AddressListField id alone; the permitted id ' +
      'stays on the field for markup inventory. SC-011 is superseded for this file.',
    components: ['ModuleConfigPanel'],
    anchorDelta: 0,
    introducesFirstAnchor: false,
  },
  {
    file: 'src/features/wizard/steps/asset/DocumentManagerSection.tsx',
    kind: 'replaces-baseline',
    authorisedBy: 'SF-14',
    decidedOn: '2026-09-02',
    reason:
      'The document-manager section anchors and rings the outer Card so inspection highlights ' +
      'the whole section including the header; CardContent stays plain. The field keeps id ' +
      'doc-manager-enabled for focus path. SC-011 is superseded for this file.',
    components: ['DocumentManagerSection'],
    anchorDelta: 1,
    introducesFirstAnchor: true,
  },
];

/**
 * One sanctioned exception to "the guarded files gained no props".
 *
 * A prop appended to the permitted list is **global and permanent across all 25
 * guarded files**; a fingerprint recorded in the supersession record is per-file
 * and re-frozen the moment it is written. The scoped tool always exists, so
 * "I had to widen the list" is never a forced move (AS-3).
 */
export interface PermittedPropDecision {
  readonly prop: string;
  /** Tag the permission is scoped to; `null` means any tag. */
  readonly tag: string | null;
  readonly authorisedBy: string;
  readonly decidedOn: string;
  readonly reason: string;
}

/**
 * The permission set, and the **only** expression of it.
 *
 * `filterPermittedProps` (which drops these props at comparison time) and
 * `findAnchorProps` (which counts them, for the assertion the whole guard rests
 * on) both resolve through one predicate over this list. They were two
 * independent expressions of the same three permissions before SF-15, and a
 * one-prop asymmetry between them would let a late baseline carry a prop the
 * detector does not name — the auto-updating-golden trap restored through the
 * back door of a tidy-up (INV-22).
 *
 * Widening the list costs two keys: a decision object with prose and a date,
 * **and** an edit to the pinned expectation in `stepMarkup.structure.test.ts`.
 */
export const PERMITTED_PROP_DECISIONS: readonly PermittedPropDecision[] = [
  {
    prop: 'data-config-anchor',
    tag: null,
    authorisedBy: 'SF-12',
    decidedOn: '2026-08-30',
    reason:
      'The identifying attribute resolution reads. Renders nothing, occupies no space, cannot ' +
      'move a pixel — which is why it is permitted where a class or style change is not.',
  },
  {
    prop: 'configAnchor',
    tag: null,
    authorisedBy: 'SF-12',
    decidedOn: '2026-08-30',
    reason: 'The same attribute where it crosses a component prop boundary instead of a DOM one.',
  },
  {
    prop: 'id',
    tag: 'AddressListField',
    authorisedBy: 'SF-12',
    decidedOn: '2026-08-30',
    reason:
      'Scoped to one tag deliberately. A blanket `id` permission would let ids be added anywhere, ' +
      'and because ids are tracked values an existing id could then also change — so renaming ' +
      '`token-name` would stop failing AS-5.',
  },
];
