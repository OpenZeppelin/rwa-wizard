import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { FieldProvenanceRow, FileProvenanceGroup } from '../../../services/preview';
import type { ConfigPath } from '../../wizard/config-path';
import { isPendingCollectionSlot } from '../../wizard/config-path';
import type { CodePreviewProvenance } from '../provenanceState';
import { splitPath } from './splitPath';

/**
 * One file's rows, split for rendering.
 *
 * `primary` is non-empty whenever the group exists at all: a `file` or
 * `created` row is typed to the literal `'primary'` (SF-11 INV-8), and a group
 * with only secondary ranges is impossible because significance is answered
 * per attribution against a query that matched. If that ever stops holding,
 * an empty `primary` renders as a group carrying only the secondary sub-list —
 * no crash, and no special case in the component to keep correct. INV-3.
 */
export interface ImpactGroupView {
  /** Full generated path, as `groupFieldProvenance` reported it. Used for reveal and `title`. */
  readonly path: string;
  /** Everything before the last `/`; `''` for a root-level file. */
  readonly directory: string;
  /** The last segment. Never truncated in the heading. */
  readonly leaf: string;
  /**
   * Rows paired with their index in the **unpartitioned** row list.
   *
   * The index travels with the row rather than being recaptured per partition,
   * and that is the whole point (INV-5): re-indexing inside each partition
   * makes `primary[0]` and `secondary[0]` collide on the key `path#0`, React
   * reuses one row's DOM node for the other, and activating a row under
   * *Mentions* reveals a different site's range. Nothing throws, and
   * the symptom only reproduces for files with mixed significance.
   */
  readonly primary: readonly IndexedRow[];
  /** Same pairing. Empty for most fields; the busiest field has none at all. */
  readonly secondary: readonly IndexedRow[];
}

/** A row and its position in the file's full, unpartitioned row list. */
export interface IndexedRow {
  readonly row: FieldProvenanceRow;
  /** Index within `FileProvenanceGroup.rows`, before the partition. */
  readonly rowIndex: number;
}

/**
 * Everything the column can be: six resting states and one list state.
 *
 * The component `switch`es over `kind` with a `never` arm, so an eighth kind
 * added here fails `tsc` at the render site rather than falling through to a
 * blank 260px rail — which would look exactly like a layout bug. INV-2.
 */
export type FieldImpactView =
  /** AS-5(3): the target has no code preview to ask. Unreachable inside the drawer; kept total. */
  | { readonly kind: 'no-preview' }
  /** AS-5(4): a tree is on screen and its generator does not record provenance. */
  | { readonly kind: 'unsupported' }
  /** AS-5(1): nothing at all holds focus. */
  | { readonly kind: 'no-focus' }
  /** AS-5(2): something holds focus and it writes no config path. Distinct from `empty`. */
  | { readonly kind: 'not-a-field' }
  /**
   * AS-4, narrowed: the tree on screen no longer matches the live draft **and
   * there is no prior answer to keep on screen**. Reached only when the lookup
   * against the tree on screen yields nothing — a field the current tree does
   * not know about yet, which is exactly the case where `empty`'s claim would
   * be a lie. See the note on `stale` below for why a stale field that *does*
   * have rows no longer lands here.
   */
  | { readonly kind: 'pending'; readonly path: ConfigPath }
  /**
   * A path that names a collection index the live draft does not have yet
   * (trailing index ≥ parent length). Prefix matching would falsely populate
   * this from parent-collection provenance; this kind is the honest answer.
   * Absent optional members (omitted `token.initialSupply`, empty module
   * `config`) are **not** this kind — they fall through to provenance lookup.
   */
  | { readonly kind: 'uncreated'; readonly path: ConfigPath }
  /** AS-5(5): a resolvable field that no generated file depends on. */
  | { readonly kind: 'empty'; readonly path: ConfigPath }
  /** AS-1: the answer. `groups` is non-empty, in `groupFieldProvenance`'s path order. */
  | {
      readonly kind: 'groups';
      readonly path: ConfigPath;
      readonly stale: boolean;
      readonly groups: readonly ImpactGroupView[];
    };

/**
 * Every input the view is a function of. Three, enumerated so the standing
 * one-test-per-input rule has something to enumerate against.
 *
 * The input space is **four** reachable states, and it used to be three. When
 * `path` came only from SF-12's hook, both fields derived from the same
 * `isFocusTarget` gate — `path !== null` implied `hasFocusedElement` — and
 * `{ path: non-null, hasFocusedElement: false }` was unreachable by contract.
 * It is now the ordinary case for an item the user just created: the Add button
 * disabled itself, focus fell to the body, and the inspected subject still names
 * the created item. The path is supplied by `resolveImpactSubject`, which may
 * outlive live focus; `hasFocusedElement` still comes from SF-12 unchanged, so
 * the two are independent and both statements stay true.
 *
 * **No logic changed for it.** The function was already total over that state
 * and already treats the path as the stronger evidence, which is exactly the
 * wanted behaviour — so the previously-unreachable branch became reachable and
 * correct on the same day. Requiring `hasFocusedElement` before honouring a path
 * would break precisely the case this now serves. INV-9, INV-32.
 */
export interface FieldImpactInput {
  /** `useCodePreview().provenance`, or `null` when the target has no codegen service. */
  readonly provenance: CodePreviewProvenance | null;
  /** SF-12's answer for the element that currently has focus. */
  readonly path: ConfigPath | null;
  /** SF-12's answer for whether anything at all has focus. Splits AS-5(1) from AS-5(2). */
  readonly hasFocusedElement: boolean;
  /** Live draft; used to detect pending collection slots before provenance lookup. */
  readonly config?: RWAConfig;
}

/**
 * The column's whole decision, as a pure function of three inputs.
 *
 * Reads nothing else — no `document`, no `window`, no ref, no module-level
 * value, no clock. Reaching for `document.activeElement` to recover a
 * distinction would be impure and, worse, stale: moving focus from `<body>` to
 * an unresolvable control changes nothing SF-12 publishes, so no re-render
 * happens and the column would keep saying "No field selected" beside a plainly
 * focused control. INV-9.
 *
 * **Never throws.** `groupFieldProvenance` is documented never to throw for a
 * `ConfigPath` built by SF-6's builders against a loader-narrowed
 * `ProvenanceResult` (SF-11 INV-13), and this adds no parsing of its own.
 *
 * **The order of the branches below is load-bearing in two places, and is not
 * a style choice (INV-10).**
 */
export function toFieldImpactView(input: FieldImpactInput): FieldImpactView {
  const { provenance, path, hasFocusedElement, config } = input;

  // 1. Nothing can be asked.
  if (provenance === null || provenance.state.kind === 'none') {
    return { kind: 'no-preview' };
  }

  // 2. Before the field states, deliberately. If the generator does not record
  //    provenance, "select a configuration field" is a lie — focusing one will
  //    not help, and the user would keep trying.
  if (provenance.state.kind === 'unsupported') {
    return { kind: 'unsupported' };
  }

  // 3 / 4. The two absences of a field, told apart.
  if (path === null) {
    return hasFocusedElement ? { kind: 'not-a-field' } : { kind: 'no-focus' };
  }

  // Only a pending collection slot (trailing index ≥ parent length) is
  // "uncreated". Absent optional members — omitted `token.initialSupply`, a
  // selected module with no `config` yet — still name live fields and must
  // fall through to provenance lookup, not the "Not added yet" resting state.
  if (config !== undefined && isPendingCollectionSlot(config, path)) {
    return { kind: 'uncreated', path };
  }

  // 5. Freshness — still decided HERE, at render, from two published strings,
  //    with no effect, no timer and nothing to close afterwards, and still
  //    AFTER the field states. That placement is the anti-flicker guarantee and
  //    is untouched: ahead of rows 3-4, every keystroke anywhere in the wizard
  //    would flip an UNFOCUSED column between `no-focus` and `pending`, and
  //    with no field there is nothing to be stale about. INV-10, INV-35.
  //
  //    What changed in this round is what staleness *renders*, not when it is
  //    decided. It is now a flag on the answer rather than a fork away from it,
  //    because tearing the rows down produced the very flicker the ordering
  //    above exists to prevent — one blink to a placeholder per keystroke, in
  //    the one field the user is looking at, since regeneration is debounced
  //    per character.
  //
  //    Keeping the rows is not a stale-data hazard, and the reason is specific:
  //    `state.identity` is the identity of the tree **on screen**, and SF-5
  //    INV-21 commits the tree, its provenance and that identity in one render.
  //    So while this flag is true the rows and the code pane are the same
  //    generation, and activating a row lands on the line the user can see. The
  //    thing that has moved on is the draft, which has not been rendered
  //    anywhere yet. INV-35's forbidden case — rows computed against a tree that
  //    is no longer on screen — remains impossible, and remains impossible for
  //    the same structural reason as before rather than because of this branch.
  const stale = provenance.state.identity !== provenance.liveIdentity;

  // 6 / 7. The one call into the seam, made exactly once and bound once: the
  //        naturally-written `lookup(path).groups.length === 0 ? … : lookup(path)`
  //        doubles the per-render cost of the only linear operation on a hook
  //        that re-renders on every focus change in the app. INV-11.
  const result = provenance.state.lookup(path);
  if (result.groups.length === 0) {
    // The one place staleness still costs the user their rows, because there
    // are none to keep — and `empty` is the only state permitted to claim
    // anything about the generated code (INV-37), so it may not be shown about
    // a tree that is mid-rebuild. This is the narrowed `pending`.
    return stale ? { kind: 'pending', path } : { kind: 'empty', path };
  }
  return { kind: 'groups', path, stale, groups: toImpactGroups(result.groups) };
}

/**
 * `FileProvenanceGroup[]` → `ImpactGroupView[]`.
 *
 * Partitions each file's rows by **declared significance and nothing else** —
 * no branch on line text, command name, file extension, path spelling or row
 * position (INV-8) — preserving the seam's `startLine` order inside each part,
 * and splits the path for the two-line heading.
 *
 * One pass per group, one-to-one over the input: no `filter` on the group
 * array, no dedupe, no cap, no truncation. File hiding is entirely the seam's
 * (SF-5 INV-13), asked once at `groupFieldProvenance`; a second hiding rule
 * here would diverge from it the day a generator adds a kind, and the user
 * would see a file the tree shows but the column claims their field does not
 * touch. INV-4, INV-6.
 */
export function toImpactGroups(groups: readonly FileProvenanceGroup[]): readonly ImpactGroupView[] {
  return groups.map((group) => {
    const primary: IndexedRow[] = [];
    const secondary: IndexedRow[] = [];

    // The index is captured over the FULL row list and travels with the row.
    group.rows.forEach((row, rowIndex) => {
      const indexed: IndexedRow = { row, rowIndex };
      if (row.significance === 'secondary') secondary.push(indexed);
      else primary.push(indexed);
    });

    const { directory, leaf } = splitPath(group.path);
    return { path: group.path, directory, leaf, primary, secondary };
  });
}
