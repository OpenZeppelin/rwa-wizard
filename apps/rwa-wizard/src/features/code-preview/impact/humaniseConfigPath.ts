import type { ConfigPath } from '../../wizard/config-path';

/**
 * A `ConfigPath` split into the two parts the column's header renders: the
 * context that locates the field, and the field itself.
 *
 * `'token.name'`                        → `{ context: '',                          field: 'Name' }`
 * `'accessControl.roles[0].addresses'`  → `{ context: 'Access control · Roles 1 · ', field: 'Addresses' }`
 *
 * The split exists for the same reason `SplitPath`'s does, and mirrors it
 * deliberately: **the last segment is never truncated**. The header rail is
 * ~155px after the caption, a three-segment path overruns it, and the segment
 * a truncating single string loses is the one the user is actually looking at.
 */
export interface HumanConfigPath {
  /**
   * Everything before the field, already carrying its trailing separator, or
   * `''` at depth 1.
   *
   * The separator lives in this string rather than in a `::after` rule on
   * purpose: this element is part of the region's accessible name (INV-41), and
   * generated content is not. Without it the name reads
   * *"Access control · Roles 1Addresses"*.
   */
  readonly context: string;
  /** The field itself. Rendered `shrink-0` and never truncated. */
  readonly field: string;
}

const SEPARATOR = ' · ';

/**
 * `ConfigPath` → the header's two parts, as a pure function of the path.
 *
 * **This is a formatting of data, not authored copy, and that distinction is
 * why it does not live in `@openzeppelin/rwa-wizard-copy` (INV-38).** It is the
 * same category as `splitPath`, which formats a generated file path for the
 * same header: the words come from the config schema the user is editing, not
 * from prose someone wrote, and there is no sentence here to localise. What it
 * replaces — the raw `token.name` rendered as the column's heading — was data
 * too; it was just data rendered as a code identifier at the one place in the
 * drawer a first-time reader looks for a subject.
 *
 * The alternative considered and rejected was reading the focused control's own
 * accessible label out of the DOM, which would show the exact words the form
 * shows. It is better copy and a worse seam: it makes `toFieldImpactView`
 * impure (INV-9 is precisely that it reads no `document`), it puts a string on
 * screen whose provenance the copy-ownership scan cannot classify, and it
 * widens SF-12's published contract for one line of chrome. Recorded as an open
 * question rather than silently foreclosed.
 *
 * Total: never throws, for any string. An empty path yields an empty field, and
 * an unrecognised shape degrades to itself rather than to an error.
 */
export function humaniseConfigPath(path: ConfigPath): HumanConfigPath {
  const segments = path
    .split('.')
    .map(inlineIndex)
    .filter((segment) => segment.length > 0)
    .map(humaniseSegment);

  // Not `.at(-1)`: the app's lib target predates it, and an empty `segments`
  // is reachable for the empty string, so the `?? ''` is load-bearing under
  // `noUncheckedIndexedAccess` rather than defensive noise.
  const field = segments[segments.length - 1] ?? '';
  const context = segments.slice(0, -1).join(SEPARATOR);
  return { context: context === '' ? '' : `${context}${SEPARATOR}`, field };
}

/**
 * `'roles[0]'` → `'roles 1'`. The index is presented **1-based**, because it
 * names the first role to a user who has never seen a zero-based one, and the
 * column is the only place in the wizard where an index surfaces at all.
 *
 * It stays **inside** its segment rather than becoming one of its own: the
 * index belongs to the collection it indexes, and splitting it out reads as
 * *"Roles · 1 · Addresses"* — three crumbs where there are two things.
 */
function inlineIndex(segment: string): string {
  const open = segment.indexOf('[');
  if (open === -1) return segment;

  const index = Number.parseInt(segment.slice(open + 1), 10);
  const name = segment.slice(0, open);
  return Number.isNaN(index) ? name : `${name} ${index + 1}`;
}

/**
 * `'accessControl'` → `'Access control'`; `'maxHolders'` → `'Max holders'`.
 *
 * Sentence case rather than title case: the segments are field names, they read
 * as a phrase in the header, and title-casing every word turns
 * *"Access Control · Roles 1 · Addresses"* into something that looks like a
 * navigation crumb rather than the name of the thing you just typed into. A
 * pure digit segment (an array index) passes through untouched.
 */
function humaniseSegment(segment: string): string {
  if (/^\d+$/.test(segment)) return segment;

  const spaced = segment.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
