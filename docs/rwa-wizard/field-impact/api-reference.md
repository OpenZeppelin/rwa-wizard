# Field Impact — API Reference

Everything the field-impact column exports, taken from the source. All functions are synchronous;
none returns a `Promise`.

The surface is **feature-internal**. Nothing here is re-exported from
`features/code-preview/index.ts`, and nothing outside the code-preview feature imports it — which is
what lets this feature claim its public API is unchanged. The two components are consumed only by
the drawer body.

```ts
import {
  humaniseConfigPath,
  resolveImpactSubject,
  splitDirectory,
  splitPath,
  toFieldImpactView,
  toImpactGroups,
  useFieldImpact,
} from '../impact';
import type {
  FieldImpactBinding,
  FieldImpactInput,
  FieldImpactLatchProps,
  FieldImpactView,
  HumanConfigPath,
  ImpactGroupView,
  ImpactSubjectInput,
  IndexedRow,
  SplitDirectory,
  SplitPath,
} from '../impact';
```

The column also **reads** one module outside the feature: `features/wizard/inspected-anchor`, which
owns which configuration location the column is describing. That direction is one-way — the
selection model imports nothing from `code-preview` — and its surface is documented
[below](#featureswizardinspected-anchor).

---

## Types it consumes

These are owned upstream and are listed because every signature below mentions them.

```ts
/** A string union derived from `RWAConfig` — e.g. `'token.name'`, `'compliance.modules[0].moduleId'`. */
type ConfigPath = PathsOf<RWAConfig>;

/** Inclusive, 1-indexed line range in a generated file. */
interface PreviewLineRange {
  readonly startLine: number;
  readonly endLine: number;
}

/** One attribution site. `file` and `created` are typed to the literal `'primary'`. */
type FieldProvenanceRow =
  | { readonly kind: 'file'; readonly significance: 'primary' }
  | { readonly kind: 'created'; readonly significance: 'primary' }
  | {
      readonly kind: 'range';
      readonly range: PreviewLineRange;
      readonly significance: FieldProvenanceSignificance;
    };

/** Rows for one file. `rows` is non-empty; a file with nothing to show is omitted upstream. */
interface FileProvenanceGroup {
  readonly path: string;
  readonly kind: StructuralGeneratedFileKind;
  readonly rows: readonly FieldProvenanceRow[];
}

/** What the wizard knows about provenance for the tree currently on screen. */
interface CodePreviewProvenance {
  readonly state: PreviewProvenanceState;
  /** Generate key of the draft as it is right now, undebounced. `null` when there is no service. */
  readonly liveIdentity: PreviewGenerateKey | null;
}

type PreviewProvenanceState =
  | { readonly kind: 'none' }
  | { readonly kind: 'unsupported'; readonly identity: PreviewGenerateKey }
  | {
      readonly kind: 'available';
      readonly identity: PreviewGenerateKey;
      /** Pure, synchronous, never throws for a wizard `ConfigPath`. */
      readonly lookup: (path: ConfigPath) => FieldProvenanceResult;
    };

/** What activation sends. `range` omitted or null means "open the file, mark nothing". */
type RevealInPreview = (target: CodePreviewRevealTarget) => void;

interface CodePreviewRevealTarget {
  readonly path: string;
  readonly range?: PreviewLineRange | null;
}
```

---

## `impact/fieldImpactView.ts`

### `toFieldImpactView(input: FieldImpactInput): FieldImpactView`

The column's whole decision, as a pure function of three inputs.

**`input` (`FieldImpactInput`):**

- `provenance` (`CodePreviewProvenance | null`) — from the preview hook; `null` when the target has
  no codegen service.
- `path` (`ConfigPath | null`) — the configuration location the focused element writes, or `null`.
- `hasFocusedElement` (`boolean`) — whether a live control holds focus at all. This is what separates
  "nothing is focused" from "something is focused and it writes no configuration".

**Returns:** `FieldImpactView` — one of eight shapes, decided by an ordered table. See
[states.md](./states.md#the-order-is-load-bearing-in-two-places).

**Throws:** nothing. The provenance lookup is documented never to throw for a `ConfigPath` built by
the wizard's own path builders against a narrowed provenance result, and this function adds no
parsing of its own.

It reads **nothing** beyond its arguments — no `document`, no `window`, no ref, no
module-level value, no clock. Reaching for `document.activeElement` to recover a distinction would
be impure and, worse, stale: moving focus from `<body>` to an unresolvable control changes nothing
the focus resolver publishes, so no re-render happens, and the column would keep saying "No field
selected" beside a plainly focused control.

The path may outlive live focus (inspected subject after Add). `{ path: non-null, hasFocusedElement:
false }` is ordinary; the function treats the path as the stronger evidence. Optional `config` is
what lets a pending collection slot become `uncreated` rather than a false `empty`/`groups` answer
from parent-collection provenance.

### `toImpactGroups(groups: readonly FileProvenanceGroup[]): readonly ImpactGroupView[]`

`FileProvenanceGroup[]` → `ImpactGroupView[]`. Partitions each file's rows by **declared
significance and nothing else** — no branch on line text, command name, file extension, path
spelling or row position — preserving the seam's line order inside each part, and splits the path
for the two-line heading.

One pass per group, one-to-one over the input: no `filter` on the group array, no dedupe, no cap, no
truncation. File hiding belongs to the provenance seam and is asked once upstream.

### `interface FieldImpactInput`

```ts
interface FieldImpactInput {
  readonly provenance: CodePreviewProvenance | null;
  readonly path: ConfigPath | null;
  readonly hasFocusedElement: boolean;
  /** Live draft; used to detect pending collection slots before provenance lookup. */
  readonly config?: RWAConfig;
}
```

### `type FieldImpactView`

```ts
type FieldImpactView =
  /** The target has no code preview to ask. Unreachable inside the drawer; kept total. */
  | { readonly kind: 'no-preview' }
  /** A tree is on screen and its generator does not record provenance. */
  | { readonly kind: 'unsupported' }
  /** Nothing at all holds focus. */
  | { readonly kind: 'no-focus' }
  /** Something holds focus and it writes no configuration path. */
  | { readonly kind: 'not-a-field' }
  /** The tree on screen no longer matches the live draft. Rows gone, field name kept. */
  | { readonly kind: 'pending'; readonly path: ConfigPath }
  /** A path that resolves in the anchor layer but the live draft does not hold yet. */
  | { readonly kind: 'uncreated'; readonly path: ConfigPath }
  /** A resolvable field that no generated file depends on. */
  | { readonly kind: 'empty'; readonly path: ConfigPath }
  /** The answer. `groups` is non-empty, in the seam's path order. */
  | {
      readonly kind: 'groups';
      readonly path: ConfigPath;
      /** A regeneration is in flight. The rows are kept and marked, never torn down. */
      readonly stale: boolean;
      readonly groups: readonly ImpactGroupView[];
    };
```

`stale` is required rather than optional, so a construction site that omits it fails `tsc` instead
of claiming the rows are current. See
[states.md](./states.md#freshness-a-flag-not-a-teardown).

### `interface ImpactGroupView`

```ts
interface ImpactGroupView {
  /** Full generated path, as the seam reported it. Used for reveal and for `title`. */
  readonly path: string;
  /** Everything before the last `/`; `''` for a root-level file. */
  readonly directory: string;
  /** The last segment. Never truncated in the heading. */
  readonly leaf: string;
  /** Rows paired with their index in the **unpartitioned** row list. */
  readonly primary: readonly IndexedRow[];
  /** Same pairing. Empty for most fields; the busiest field has none at all. */
  readonly secondary: readonly IndexedRow[];
}
```

`primary` is non-empty whenever the group exists at all: a whole-file or created row is typed to the
literal `'primary'`, and a group with only secondary ranges cannot occur because significance is
answered per attribution against a query that matched. If that ever stops holding, an empty
`primary` renders as a group carrying only the secondary sub-list — no crash, and no special case in
the component to keep correct.

### `interface IndexedRow`

```ts
interface IndexedRow {
  readonly row: FieldProvenanceRow;
  /** Index within `FileProvenanceGroup.rows`, before the partition. */
  readonly rowIndex: number;
}
```

The index travels with the row rather than being recaptured per partition, and that is the whole
point. See [states.md](./states.md#the-groups-shape) for the collision it makes unrepresentable.

---

## `impact/splitPath.ts`

### `splitPath(path: string): SplitPath`

```ts
interface SplitPath {
  readonly directory: string;
  readonly leaf: string;
}
```

`'contracts/rwa-token/src/contract.rs'` → `{ directory: 'contracts/rwa-token/src', leaf: 'contract.rs' }`.
`'README.md'` → `{ directory: '', leaf: 'README.md' }`.

Total: never throws, for any string. A path ending in `/` yields an empty leaf rather than an error —
the heading then renders the directory alone, which is degraded but honest, and no generator in this
repo produces one.

### `splitDirectory(directory: string): SplitDirectory`

```ts
interface SplitDirectory {
  /** Everything before the last segment. `''` when there is only one segment. */
  readonly head: string;
  /** The last segment, with its leading `/` when there is a head. */
  readonly tail: string;
}
```

`'contracts/modules/compliance-initial-lockup-period/src'` →
`{ head: 'contracts/modules/compliance-initial-lockup-period', tail: '/src' }`.

Splits the directory line so it can lose its **middle** rather than its end. Rendered as a
shrink-priority pair with the head yielding first, a long path reads
`contracts/modules/compl…/src` instead of `contracts/modules/compliance-ini…`. End-truncation ate
the segment nearest the file, which is the one that tells five files named `contract.rs` apart.

Total: never throws. A single-segment directory yields an empty head and the whole segment as the
tail, which renders identically to the unsplit string.

---

## `impact/humaniseConfigPath.ts`

### `humaniseConfigPath(path: ConfigPath): HumanConfigPath`

```ts
interface HumanConfigPath {
  /** Everything before the field, carrying its trailing separator, or `''` at depth 1. */
  readonly context: string;
  /** The field itself. Rendered `shrink-0` and never truncated. */
  readonly field: string;
}
```

`'token.name'` → `{ context: '', field: 'Name' }`.
`'accessControl.roles[0].addresses'` → `{ context: 'Access control · Roles 1 · ', field: 'Addresses' }`.

Splits a config path into the two parts the column's header renders. Segments are sentence-cased,
and an array index is inlined into its segment and shown **1-based** — `roles[0]` becomes `Roles 1`,
not a crumb of its own, because the index belongs to the collection it indexes.

Total: never throws, for any string. An empty path yields an empty field, and an unrecognised shape
degrades to itself rather than to an error.

**The separator lives in `context`, not in a `::after` rule**, and that is a contract rather than a
style choice: this element is part of the region's accessible name, and generated content is not, so
without it the name reads _"Access control · Roles 1Addresses"_.

**Why this is not in `@openzeppelin/rwa-wizard-copy`.** It is a formatting of data, not authored
copy — the same category as `splitPath` beside it. The words come from the config schema the user is
editing, not from prose someone wrote, and there is no sentence to localise. The copy-ownership
scan exempts it by name rather than by argument.

The alternative considered and rejected was reading the focused control's own accessible label out
of the DOM, which would show the exact words the form shows. Better copy, worse seam: it makes
`toFieldImpactView` impure, puts a string on screen whose provenance the copy scan cannot classify,
and widens the focus resolver's published contract for one line of chrome.

---

## `impact/useFieldImpact.ts`

### `useFieldImpact(config: RWAConfig, provenance: CodePreviewProvenance | null): FieldImpactBinding`

The column's data binding: it mounts the focus-resolution hook, applies the latch, and returns the
view.

**Returns:**

```ts
interface FieldImpactBinding {
  readonly view: FieldImpactView;
  /** Spread on the column's root element. */
  readonly latchProps: FieldImpactLatchProps;
}

interface FieldImpactLatchProps {
  readonly onPointerDownCapture: () => void;
  readonly onFocus: () => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
}
```

**Throws:** nothing.

Two notes that are contract rather than implementation:

- **Mount it inside the column, not higher.** The focus hook re-renders its host on every focus
  change anywhere in the app. Mounted in the page, that is the entire wizard form; mounted here, it
  is one 260px region.
- **`latchProps` must be spread on the root.** The capture-phase pointer handler is what arms the
  latch before focus moves, and the focus handler is what makes the column's tab stop populate its
  rows. Spreading them on an inner element loses both. See [latch.md](./latch.md).

The hook holds **one** `useState` — the latch's gate, the last answer it rendered, and the draft that
was in force when the gate opened. It performs **no state write during render**; the answer is
maintained by a post-commit effect and the gate by the three handlers above. The generate-key stamp
the earlier version needed is gone with the held path it guarded. See
[latch.md](./latch.md#what-most-of-the-latch-became).

---

## `impact/impactSubject.ts`

### `resolveImpactSubject(input: ImpactSubjectInput): ConfigPath | null`

Which configuration path the column describes, as a pure function of five values. No hook, no
context, no DOM — the whole decision is a table.

```ts
interface ImpactSubjectInput {
  /** The inspected anchor, resolved against the live draft and existence-checked. */
  readonly inspectedPath: ConfigPath | null;
  /** The focus resolver's answer for whatever holds focus right now. */
  readonly livePath: ConfigPath | null;
  /** Whether a live, connected, non-`body` element holds focus at all. */
  readonly liveHasFocus: boolean;
  /** Whether the user is pointing at, or focused inside, the column itself. */
  readonly columnHasFocus: boolean;
  /** The answer the column was rendering when the user reached into it, or `null`. */
  readonly heldAnswer: ConfigPath | null;
}
```

**Four clauses, in order, and the order is load-bearing:**

1. **A live control that writes nothing, with focus outside the column, wins over the subject →
   `null`.** The Review step's identity-support option demonstrably changes the generated tree and
   still resolves to no configuration location, and the user is owed that true statement rather than
   a sticky older answer. Restricted to focus _outside_ the column, because a control inside the
   column also writes nothing and clearing there would break the latch.
2. **Otherwise the subject, whatever focus is doing.** This covers both cases it exists for with one
   clause: focus landed nowhere after an add, and focus moved into the column.
3. **Otherwise live focus's own answer**, which may itself be `null`.
4. **Otherwise, if the user is inside the column, the answer it last rendered.** The floor under a
   location that resolves but does not exist yet. See
   [latch.md](./latch.md#why-the-subject-alone-was-not-enough).

**Returns:** a `ConfigPath`, or `null`. **Throws:** nothing.

`heldAnswer` is **inert** whenever `columnHasFocus` is false, over the whole input space — a property
asserted rather than argued, because it is what confines the latch to one uninterrupted reach.

---

## `features/wizard/inspected-anchor`

The selection model: which configuration location the column is describing. A curated surface — the
store factory and the raw subject key stay internal, because a caller that could store a key would
re-introduce the staleness the anchor removes.

```ts
import {
  InspectedAnchorProvider,
  useInspectAnchor,
  useInspectedConfigPath,
  useIsInspected,
} from '../../wizard/inspected-anchor';
import type { InspectedAnchorProviderProps } from '../../wizard/inspected-anchor';
```

### `InspectedAnchorProvider`

```tsx
interface InspectedAnchorProviderProps {
  /** Opaque token whose change drops the subject. Whatever it names, the subject did not survive it. */
  readonly scopeToken: string;
  /** The selected compliance modules, for the key walk's dynamic module-config channel. */
  readonly modules: readonly ComplianceModuleSelection[];
  readonly children: ReactNode;
}
```

Mounts the subject slot and its writers: two bubble-phase `document` listeners (`click` and
`focusin`, both write-only) and an effect that clears on a scope change. It must sit **above both**
the wizard layout (the writers) and the code-preview drawer (the reader). The store is created once
by a ref, so the provider re-rendering never re-renders a consumer and a subject change never
re-renders the provider.

`scopeToken` is passed as `` `${resetKey}-${activeDraftId ?? 'none'}-${currentStep}` ``. The step
half is a genuine third input rather than a redundancy: a claim topic still exists in the draft while
the user is on the Compliance step, so an existence check alone would leave the column describing an
item that is nowhere on screen.

`modules` is the narrowest slice that lets the key walk split a module-config field's own id into an
anchor. Without it, a click on a scalar module-config field falls through to the enclosing panel and
the column describes the _module_ rather than the field being typed in. The store still holds no
draft, so nothing in the module can go stale.

**There is no `focusout` listener and neither listener ever clears.** Focus landing nowhere is
exactly the case the subject exists to survive — the Add button disables itself after an add and
focus falls to the body — so a clear-on-focus-departure would ship the defect this feature fixes.

### `useInspectedConfigPath(config: RWAConfig): ConfigPath | null`

The subject as a live `ConfigPath`, or `null`. Three hops on **every render, with no memo**: decode
the key, drop it if its item is gone, else resolve it against the live draft. Resolving per render
rather than storing a path is what makes an index shift a non-event. A `useMemo` keyed on the subject
and not on the configuration would defeat exactly the existence check, in the one place nobody looks.

The cost is bounded: one decode, at most one scan of a collection the wizard caps at fifteen, and one
path build.

### `useIsInspected(anchor: ConfigAnchorKey | undefined): boolean`

Whether `anchor` is the subject. `false` for `undefined`, and outside the provider.

The store snapshot is the **boolean**, not the subject, so only the item whose answer actually
flipped re-renders. Returning the subject and letting the caller compare would re-render every chip
on every subject change — and the subject changes on every focus move anywhere in the wizard.

### `useInspectAnchor(): (anchor: ConfigAnchorKey) => void`

The stable writer, for the two add handlers. Referentially stable for the provider's life, so a
component that only writes never re-renders because of the subject.

The returned function is a **no-op in exactly two cases**, both of which return without writing and
without notifying: the anchor is already the subject, and the anchor is not inspectable. The second
is what makes an add handler's direct write survive its own interaction under either handler
ordering — see
[selection.md](./selection.md#the-two-add-handlers-and-why-the-refusal-is-doing-the-work).

**Outside the provider all three hooks are inert** — `null`, `false`, and a stable no-op — and none
of them throws. That is the dependency-injection seam, and it is bought deliberately: the adopted
components are rendered with no provider by test harnesses and by the markup guard, and a throwing
hook would take every one of them down. The cost is that forgetting the provider would ship the
feature inert with a green suite, which is why a structural assertion that the wizard page mounts it
above both subtrees is required rather than optional.

### Supporting exports in `features/wizard/focused-path`

Four additions, all pure and total:

| Export                                      | Answers                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `isConfigAnchorKey(value: string)`          | Is this string a valid anchor key? Exactly what the parser accepts.                     |
| `isInspectableAnchor(anchor: ConfigAnchor)` | Can this ever be the subject? `false` for exactly the two draft anchors.                |
| `anchorItemExists(anchor, config)`          | Does the item it names still exist in this draft?                                       |
| `resolveFocusedAnchorKey(element, modules)` | Which anchor key does this element name? The extracted first hop of the focus resolver. |

The two predicates are exhaustive `switch`es with `never` tails, so a new anchor kind that also names
a pending slot is a compile error in both rather than a silent `true`. `anchorItemExists` expresses
existence through the very index helpers the resolver resolves with, so the two cannot drift apart.

---

## `components/PreviewImpactColumn.tsx`

### `PreviewImpactColumn`

```tsx
interface PreviewImpactColumnProps {
  /** The live draft. Focus resolution is a function of the focused element AND the draft. */
  readonly config: RWAConfig;
  /** `useCodePreview().provenance`; `null` when the target has no codegen service. */
  readonly provenance: CodePreviewProvenance | null;
  /** `useCodePreview().revealInPreview`; `null` disables activation without hiding rows. */
  readonly onReveal: RevealInPreview | null;
  /**
   * `preview.persistence.open` (or the drawer's `open` prop).
   * Auto-select and open-transition re-issue run only while true.
   */
  readonly drawerOpen: boolean;
}

declare const PreviewImpactColumn: MemoExoticComponent<FC<PreviewImpactColumnProps>>;
```

Renders the region: the accessible heading, the one-line header (caption plus humanised field name)
outside the scroll region, and either the grouped list or an empty state.

**Deferred reveal.** The column owns the held half of a split activation: a row activated while the
tree is stale reveals its file immediately and hands back its site, which the column re-resolves
against the first fresh tree and issues once. Held state is keyed by config path, file path and the
row's unpartitioned index — never by the line range — and is dropped without a reveal if the field
moved on, the file left the tree, or the site is no longer a range. See
[states.md](./states.md#activating-a-row-while-it-is-refreshing).

**Refresh signalling.** When a regeneration is in flight the root carries `aria-busy` and
`data-impact-stale`, both true for a stale `groups` and for `pending`. Neither adds a node, changes
the column's height or replaces content — the flag flips on every keystroke, so it must not
displace anything. `data-impact-stale` drives a CSS opacity fade with a 400ms delay, off entirely
under `prefers-reduced-motion`. There is no JS timer anywhere in the feature.

**Memoised, with the default shallow comparator.** The sheet re-renders on every `pointermove` of a
height drag while none of these props change, and each unmemoised render would run a provenance
lookup linear in the provenance size at 60Hz — a drag that stutters, with the cause looking like the
code pane's problem. All four props are stable across such a render: `provenance` is memoised on
the provenance state and the live identity, `revealInPreview` is a `useCallback`, `config` only
changes on an edit, and `drawerOpen` is a boolean primitive.

The props interface is **closed at four** deliberately, because that is what makes the memo's
correctness enumerable. There is no custom `areEqual` — that would be a fifth thing to keep
correct — and there is no other memo or cache anywhere in the feature. The cheapest way to honour a
rule about memo keys is to have no key to get wrong.

---

## `components/PreviewImpactRow.tsx`

### `PreviewImpactRow`

```tsx
interface PreviewImpactRowProps {
  /** The generated file this site is in. Named in the row's label. */
  readonly path: string;
  readonly row: FieldProvenanceRow;
  /** Rendered under the "Mentions" heading. Presentation only. */
  readonly secondary: boolean;
  /**
   * Shared activation path (column-local `activateSite`). `null` disables the
   * button without hiding the row.
   */
  readonly onActivate: (() => void) | null;
  /**
   * True when this row is the column's active site for the current subject.
   * Drives `aria-current="true"` and the selected-background class.
   * Default false. Does not change activation behaviour.
   */
  readonly active?: boolean;
}

declare function PreviewImpactRow(props: PreviewImpactRowProps): ReactElement;
```

One activatable site: a real `<button type="button">` inside an `<li>`, laid out as an arrow and a
truncating label.

The arrow is the **rest-state** affordance, and deliberately not a hover effect: activating a row
jumps the code pane, which is the whole point of the column, and nothing about a muted line of text
at 11px says so until the pointer is already on it — a keyboard user and a reader who never hovers
got no signal at all. It is a glyph rather than colour, because the reveal accent is the only
colour-carrying signal in the composition and a second one would compete with it. It is
`aria-hidden`: the row's whole message is its `aria-label`, and a decorative glyph in the
accessible name is noise. It is `shrink-0`, so the label truncates and the affordance never does.

It is an **arrow, not a chevron**. A right-pointing chevron is the disclosure glyph — it is what the
file tree beside this column uses to expand a folder — so at rest, in a list of indented lines under
a filename, it read as _these rows open up_. They do not; they take you somewhere. An arrow says go
without borrowing the tree's vocabulary.

**Label and activation, by row kind:**

| `row.kind`                       | Label                 | Activation sends  |
| -------------------------------- | --------------------- | ----------------- |
| `range`, `startLine !== endLine` | `Lines {start}–{end}` | `{ path, range }` |
| `range`, `startLine === endLine` | `Line {start}`        | `{ path, range }` |
| `file`                           | `Whole file`          | `{ path }`        |
| `created`                        | `Creates this file`   | `{ path }`        |

Each activation fires `onActivate` **exactly once** — one `onClick`, no effect, no second path. The
column's `activateSite` owns reveal / defer; the row only calls that shared path. A
repeat activation of the same row re-triggers the mark, because the reveal callback bumps its
retrigger token on every call; that is inherited from the reveal plumbing, not re-implemented here.

A `created` row **never** synthesises a line jump. The `range` key is present only in the range
arm — omitted, not set to `undefined` — so `'range' in target` is a truthful test. Telling a user
that a field created a file _at line 1_ is a claim the generator never made, and it is wrong for
every file that opens with a licence header.

The row also carries `data-row-span`, the range's line count, read by the layout probe to pick the
widest range to test reveal against. It carries no behaviour and no component reads it.
