import ts from 'typescript';

import type { MarkupSupersession } from './stepMarkupSanction';
import { PERMITTED_PROP_DECISIONS } from './stepMarkupSanction';

/**
 * JSX structural fingerprint for the AS-5 guard (INV-5, INV-6, INV-7).
 *
 * AS-5 is the dev's own guarantee: the guarded files differ from HEAD by added
 * identifying attributes and nothing else. Proving that mechanically needs two
 * properties, and this module is one half of each.
 *
 * **Sensitive.** The fingerprint must detect every structural mutation AS-5
 * forbids — an element added, removed, re-nested, re-ordered or renamed, and a
 * `className` / `style` / `id` that changed. It must equally be immune to
 * Prettier reflow, because inserting one prop makes Prettier break a one-line
 * element across several and a text-shaped check would have to be loosened
 * until it checked nothing. Reflow immunity is bought by never reading source
 * text: an attribute's value becomes a recursive *syntax signature* built from
 * node kinds and literal values, so line breaks, indentation, trailing commas,
 * comments and quote style are invisible while a single changed character in a
 * class name is not.
 *
 * **Unforgeable.** The fingerprint records each element's *complete* prop-name
 * list, anchors included. The permitted-new-prop filter is applied at
 * comparison time (`filterPermittedProps`), never at capture time. A baseline
 * regenerated after the anchors land therefore carries them and is provably
 * late — see `findAnchorProps`. Excluding them at capture would make
 * a post-anchor baseline byte-identical to a pre-anchor one, which is the
 * auto-updating-golden trap this repo built SF-4 to prevent.
 *
 * Pure over a source string, so INV-7 can mutate a fixture in memory and
 * compare. All file I/O lives in the generator script and the test.
 */

/** Attribute names whose value is compared, not merely counted. INV-5. */
const TRACKED_VALUE_PROPS = ['className', 'style', 'id'] as const;

/**
 * **The permission set, produced once.** INV-22.
 *
 * `filterPermittedProps` drops a prop iff this returns `true`, and
 * `findAnchorProps` counts a prop iff this returns `true`. One predicate, two
 * consumers — not two sets kept in step, which is what they were before SF-15
 * (`new Set(PERMITTED_NEW_PROPS)` plus a conditional `id`, versus
 * `isAnchorProp || isPermittedId`).
 *
 * The asymmetry that mattered: let the filter drop one prop the detector does
 * not count, and a baseline regenerated after that prop landed carries it while
 * INV-6 clause 1 — the assertion the whole guard rests on — goes green having
 * checked nothing. Both mutation batteries still pass, because both compare
 * filtered-to-filtered and the gap is invisible from that side. Sharing a
 * predicate makes the divergence unexpressible rather than merely absent today.
 */
function isPermittedProp(prop: string, tag: string): boolean {
  return PERMITTED_PROP_DECISIONS.some(
    (decision) => decision.prop === prop && (decision.tag === null || decision.tag === tag)
  );
}

/**
 * Prop names this unit is permitted to add to a guarded file, on any tag. INV-5.
 *
 * A literal tuple rather than a derivation from {@link PERMITTED_PROP_DECISIONS}
 * so SF-12's assertions keep their literal types (a `string[]` would weaken
 * them silently), and bound to the decisions' untagged subset by the pinned
 * § 4.5 clause — the same treatment `ID_PERMITTED_TAG` gets, for the same
 * reason. Neither the filter nor the detector reads it: both go through
 * {@link isPermittedProp}.
 */
export const PERMITTED_NEW_PROPS = ['data-config-anchor', 'configAnchor'] as const;

/**
 * The one tag on which a new `id` prop is permitted. Scoped deliberately: a
 * blanket "`id` is allowed" would let ids be added anywhere, and because ids
 * are tracked values an *existing* id could then also change — so renaming
 * `token-name` would stop failing AS-5.
 */
export const ID_PERMITTED_TAG = 'AddressListField' as const;

/** Marker used in place of a name for a JSX spread attribute (`{...props}`). */
const SPREAD_PROP = '...' as const;

/**
 * Syntax kinds dropped from an element's ancestor path. Prettier adds and
 * removes parentheses freely when a JSX expression changes width, so keeping
 * them would make the fingerprint reflow-sensitive — the one thing it must not
 * be.
 */
const TRANSPARENT_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.ParenthesizedExpression,
]);

export interface JsxElementFingerprint {
  /** Tag name as written: `div`, `SelectableCard`, `Card.Header`. */
  readonly tag: string;
  /**
   * Every prop name on the element, sorted, with one `'...'` entry per spread.
   * Unfiltered on purpose — see the module comment.
   */
  readonly props: readonly string[];
  /**
   * Syntax signatures of the tracked value props, plus one `'...#n'` entry per
   * spread in source order. Absent keys mean the prop is not present.
   */
  readonly values: Readonly<Record<string, string>>;
  /**
   * Kinds of the nodes between this element and its nearest enclosing JSX
   * element, outermost first. Distinguishes `{cond && <X/>}` from a bare
   * `<X/>`, so a conditional cannot be dropped without the fingerprint moving.
   */
  readonly via: readonly string[];
  /** Nested JSX elements, in source order. */
  readonly children: readonly JsxElementFingerprint[];
}

/** One guarded file's fingerprint: its top-level JSX elements, in source order. */
export type FileFingerprint = readonly JsxElementFingerprint[];

export interface StepMarkupBaseline {
  /**
   * Repo-relative glob patterns the guarded set expands from. Recorded so the
   * test compares against the same set the baseline was built from (INV-6
   * clause 2) rather than a hand-written list that can silently omit a file.
   */
  readonly globs: readonly string[];
  /** Pinned count of guarded files. A file added or deleted fails outright. */
  readonly fileCount: number;
  /** Repo-relative file path → fingerprint. */
  readonly files: Readonly<Record<string, FileFingerprint>>;
}

type JsxElementLike = ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment;

function isJsxElementLike(node: ts.Node): node is JsxElementLike {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
}

/** Collapse every whitespace run to one space, so nothing carries indentation. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Recursive syntax signature of an expression: node kinds plus the *cooked*
 * text of leaf tokens.
 *
 * Reflow-immune by construction — whitespace, comments and trailing commas are
 * trivia and produce no node. String literals contribute `node.text` rather
 * than their source, so a quote-style change is invisible while a changed
 * character is not. `cn('a', 'b')` and `"a b"` have different signatures, which
 * is intended: the fingerprint is stricter than the rendered result, so the
 * swap is reviewed rather than waved through (INV-7 case h).
 */
function syntaxSignature(node: ts.Node, source: ts.SourceFile): string {
  if (ts.isStringLiteralLike(node)) return `Str(${JSON.stringify(node.text)})`;

  const children: string[] = [];
  node.forEachChild((child) => {
    children.push(syntaxSignature(child, source));
  });

  const kind = ts.SyntaxKind[node.kind];
  if (children.length === 0) {
    return `${kind}(${JSON.stringify(collapseWhitespace(node.getText(source)))})`;
  }
  return `${kind}[${children.join(',')}]`;
}

function tagNameOf(node: JsxElementLike, source: ts.SourceFile): string {
  if (ts.isJsxFragment(node)) return '<>';
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  return collapseWhitespace(opening.tagName.getText(source));
}

function attributesOf(node: JsxElementLike): ts.JsxAttributes | undefined {
  if (ts.isJsxFragment(node)) return undefined;
  return ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
}

function readProps(
  node: JsxElementLike,
  source: ts.SourceFile
): Pick<JsxElementFingerprint, 'props' | 'values'> {
  const attributes = attributesOf(node);
  if (!attributes) return { props: [], values: {} };

  const props: string[] = [];
  const values: Record<string, string> = {};
  let spreadIndex = 0;

  for (const attribute of attributes.properties) {
    if (ts.isJsxSpreadAttribute(attribute)) {
      props.push(SPREAD_PROP);
      values[`${SPREAD_PROP}#${spreadIndex}`] = syntaxSignature(attribute.expression, source);
      spreadIndex += 1;
      continue;
    }

    const name = collapseWhitespace(attribute.name.getText(source));
    props.push(name);

    if (!isTrackedValueProp(name)) continue;
    values[name] =
      attribute.initializer === undefined
        ? 'Present' // `<input disabled />` shorthand; kept distinct from any value.
        : syntaxSignature(attribute.initializer, source);
  }

  // Sorted so a prop *reorder* — which changes nothing rendered — does not move
  // the fingerprint (INV-7's identity half), while an added or removed prop does.
  // `values` is sorted for the same reason: the baseline is compared as JSON, so
  // key insertion order is part of the fingerprint whether we intend it or not.
  props.sort();
  return { props, values: sortKeys(values) };
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

function isTrackedValueProp(name: string): boolean {
  return (TRACKED_VALUE_PROPS as readonly string[]).includes(name);
}

/**
 * Collect the JSX elements directly inside `node`, descending through every
 * non-JSX expression so `{cond && <X/>}` and `list.map(() => <Row/>)` are found
 * at the nesting depth they render at.
 */
function collectChildElements(
  node: ts.Node,
  source: ts.SourceFile,
  via: readonly string[]
): JsxElementFingerprint[] {
  const collected: JsxElementFingerprint[] = [];

  node.forEachChild((child) => {
    if (isJsxElementLike(child)) {
      collected.push(fingerprintElement(child, source, via));
      return;
    }
    const nextVia = TRANSPARENT_KINDS.has(child.kind) ? via : [...via, ts.SyntaxKind[child.kind]];
    collected.push(...collectChildElements(child, source, nextVia));
  });

  return collected;
}

function fingerprintElement(
  node: JsxElementLike,
  source: ts.SourceFile,
  via: readonly string[]
): JsxElementFingerprint {
  const children: JsxElementFingerprint[] = [];
  if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
    for (const child of node.children) {
      if (isJsxElementLike(child)) {
        children.push(fingerprintElement(child, source, []));
        continue;
      }
      if (ts.isJsxText(child)) continue; // Copy, not structure.
      const nextVia = TRANSPARENT_KINDS.has(child.kind) ? [] : [ts.SyntaxKind[child.kind]];
      children.push(...collectChildElements(child, source, nextVia));
    }
  }

  return { tag: tagNameOf(node, source), ...readProps(node, source), via, children };
}

/**
 * Fingerprint one file's JSX. `fileName` only steers the compiler's JSX/TSX
 * parsing mode; nothing about the path enters the result.
 */
export function fingerprintSource(fileName: string, sourceText: string): FileFingerprint {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX
  );
  return collectChildElements(source, source, []);
}

/**
 * Drop the props this unit is permitted to add, from either side of a
 * comparison. Applied to the working tree *and* the baseline, so the assertion
 * stays an equality rather than a subset check.
 *
 * `id` is dropped only on {@link ID_PERMITTED_TAG}. Everywhere else an `id` is
 * a tracked value, so an existing id cannot be renamed without failing AS-5 —
 * which is what makes the resolver's use of kit ids safe to rely on.
 */
export function filterPermittedProps(fingerprint: FileFingerprint): FileFingerprint {
  return fingerprint.map((element) => {
    const values = Object.fromEntries(
      Object.entries(element.values).filter(([name]) => !isPermittedProp(name, element.tag))
    );

    return {
      tag: element.tag,
      props: element.props.filter((name) => !isPermittedProp(name, element.tag)),
      values,
      via: element.via,
      children: filterPermittedProps(element.children),
    };
  });
}

export interface AnchorOccurrence {
  readonly file: string;
  readonly tag: string;
  readonly prop: string;
}

/**
 * Every permitted-new-prop occurrence in a baseline. A pre-anchor baseline has
 * none; a baseline regenerated after the anchors landed has one per anchored
 * element, and names them. INV-6 clause 1 — the load-bearing one.
 */
export function findAnchorProps(baseline: StepMarkupBaseline): AnchorOccurrence[] {
  const found: AnchorOccurrence[] = [];

  const visit = (file: string, elements: FileFingerprint): void => {
    for (const element of elements) {
      for (const prop of element.props) {
        // The same predicate the comparison filter drops by — INV-22.
        if (isPermittedProp(prop, element.tag)) found.push({ file, tag: element.tag, prop });
      }
      visit(file, element.children);
    }
  };

  for (const [file, elements] of Object.entries(baseline.files)) visit(file, elements);
  return found;
}

/**
 * How many anchor occurrences one file's fingerprint carries, **in the
 * generator's own unit**.
 *
 * Routed through {@link findAnchorProps} rather than re-counting, so
 * `anchorDelta` is denominated in the same quantity the generator enumerates
 * and § 4.6's inventory arithmetic compares — permitted new props *and*
 * permitted ids alike, fourteen plus one rather than fourteen. Re-expressing
 * the count here is how a declaration that adds a permitted `id` and declares
 * `anchorDelta: 0` ends up correct by the documentation and red in the suite,
 * with `EXPECTED_ANCHOR_PROP_COUNT` as the only edit that satisfies both
 * (INV-7).
 */
export function countAnchorProps(fingerprint: FileFingerprint): number {
  return findAnchorProps({ globs: [], fileCount: 1, files: { '': fingerprint } }).length;
}

/** What the supersede script adopted for one file, recomputed and re-checked at test time. */
export interface AdoptionSummary {
  readonly elementsBefore: number;
  readonly elementsAfter: number;
  /** Tag names present after and not before, with multiplicity, sorted. */
  readonly tagsAdded: readonly string[];
  /** Tag names present before and not after, with multiplicity, sorted. */
  readonly tagsRemoved: readonly string[];
  /** Elements whose `className` / `style` / `id` signature differs. */
  readonly valuesChanged: number;
}

export interface SupersededMarkupEntry extends MarkupSupersession {
  /**
   * What a reviewer needs to judge the *size* of what is being adopted without
   * reading a thousand lines of JSON. Recomputed from (authority, current) at
   * test time and asserted equal — so it can never go stale after a re-run and
   * can never be hand-written (INV-27).
   */
  readonly adopted: AdoptionSummary;
  /**
   * The full fingerprint, **unfiltered** — anchors recorded, not excluded,
   * exactly as the baseline records them. Same unforgeability discipline: a
   * record that carries anchors says so out loud rather than hiding them at
   * capture time.
   */
  readonly fingerprint: FileFingerprint;
}

export interface SupersededMarkupRecord {
  /**
   * Sorted by `file`, so a re-run is byte-stable and a diff reads as a list of
   * decisions top to bottom. An array rather than a map on purpose — which is
   * why uniqueness of `file` is asserted rather than inherited from object key
   * semantics (INV-6).
   */
  readonly entries: readonly SupersededMarkupEntry[];
}
