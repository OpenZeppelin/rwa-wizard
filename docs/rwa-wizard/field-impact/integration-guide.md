# Field Impact — Integration Guide

Four things a maintainer actually does with this feature: render the column, make a control appear in
it, read the view without the component, and let a list item be selected without being destroyed.
Then how the layout is verified, and the mistakes that produce a wrong answer with nothing red.

Every snippet compiles against the app's current types.

## Pattern 1: Render the column

The column needs three values, and all three already exist on the preview hook. They are threaded as
**props**, not context.

```tsx
// WizardPage.tsx — inside the existing <CodePreviewDrawer …>
<CodePreviewDrawer
  // …existing props…
  config={draftState.config}
  provenance={preview.showTrigger ? preview.provenance : null}
  onReveal={preview.showTrigger ? preview.revealInPreview : null}
/>
```

The two nullable ones use the **same guard the existing providers use**: `showTrigger` is the
condition under which there is a code preview to point at, so a `null` here means the same thing it
means everywhere else in the feature rather than a second, subtly different notion of "unavailable".

The drawer body renders the column as the third sibling and threads `drawerOpen` from the drawer's
own `open` prop (auto-select and open-transition re-issue run only while true):

```tsx
<div className="rwa-code-preview flex min-h-0 flex-1" data-tree-visible={treeVisible}>
  {/* file tree wrapper */}
  {/* code pane */}
  <PreviewImpactColumn
    config={config}
    provenance={provenance}
    onReveal={onReveal}
    drawerOpen={open}
  />
</div>
```

Four rules about that, each of which has a silent failure behind it:

1. **Mount it unconditionally.** No `treeVisible` test, no width test, no row-count test. Matching
   the container query in JavaScript would state the rule twice, the two would disagree above the
   threshold, the column would disappear at 1280px for every user with the tree shown, and no test
   in the unit suite could see it.
2. **`data-tree-visible` takes the boolean directly.** React stringifies `data-*` values including
   `false`, so this renders `"true"` / `"false"` and never an empty string or an absent attribute.
   The idiomatic boolean-attribute refactor is wrong here; see
   [README.md](./README.md#quick-start).
3. **Third, after the code pane.** DOM order is reading order is tab order.
4. **Props, not context.** The two provenance and reveal providers exist because callers inside
   kit-owned step rendering cannot receive props. The drawer is not such a caller — it is a sibling
   the page renders directly and already hands a dozen props. Props keep the drawer's inputs
   enumerable, which the column's memo depends on.

One more piece of page-level wiring, and it is the one whose absence is silent. The selection model
needs a provider above **both** the wizard layout and the drawer, because its writers are in the form
and its reader is in the drawer:

```tsx
<InspectedAnchorProvider
  scopeToken={`${resetKey}-${activeDraftId ?? 'none'}-${currentStep}`}
  modules={draftState.config.compliance.modules}
>
  {/* the wizard layout and the code-preview drawer, both inside */}
</InspectedAnchorProvider>
```

Every consumer hook degrades to inert without it — deliberately, so the adopted components can render
in harnesses and under the markup guard with no provider. The cost of that choice is that **omitting
this ships the whole selection model inert with a fully green suite**, which is why a structural test
asserts the provider opens before and closes after both subtrees.

**Why `config` is threaded rather than mounting the focus hook higher.** Mounted in the page, the
focus hook would re-render the whole wizard form on every focus change anywhere in the app — which
costs nothing today, because focus changes currently re-render nothing. Mounted inside the column, a
focus change re-renders one 260px region.

## Pattern 2: Make a control appear in the column

A control shows rows when the focus resolver can turn it into a `ConfigPath`. That resolution is not
this feature's — it is the focused-path module's — but this is where its absence is noticed, so:

- A control that carries a config anchor resolves, and the column lists its files.
- A control that does not resolves to `null`, and the column shows **Not a configuration field**.

Anchors are added with the builders in `features/wizard/focused-path`, which emit the
`data-config-anchor` attribute the resolver reads. Use a builder rather than writing the attribute
by hand: the builders own the argument separator and the encoding, and a hand-written anchor that
does not round-trip resolves to `null` in exactly the same way an unanchored control does.

Two consequences worth knowing before you go looking for a bug:

- **A control can genuinely change the generated tree and correctly resolve to nothing.** Generation
  options are not part of `RWAConfig`, so they have no configuration path to attribute to. This is
  why the "not a configuration field" copy speaks about attribution and never about effect. See
  [states.md](./states.md#the-two-empty-states-and-why-their-copy-may-not-merge).
- **A resolvable field with no files is a different state.** `empty` means the field resolved and
  the generator reported nothing depending on it. If you expected files, the question is about the
  generator's attribution, not about the anchor.

## Pattern 3: Read the view without the component

The decision is a pure function, so anything that has the three inputs can ask it — a test, a
different presentation, a debug panel.

```ts
import type { ConfigPath } from '../../wizard/config-path';
import { toFieldImpactView } from '../impact';
import type { CodePreviewProvenance } from '../provenanceState';

export function filesDeterminedBy(
  provenance: CodePreviewProvenance | null,
  path: ConfigPath | null
): readonly string[] {
  const view = toFieldImpactView({
    provenance,
    path,
    hasFocusedElement: path !== null,
  });
  return view.kind === 'groups' ? view.groups.map((group) => group.path) : [];
}
```

Note what the caller supplies for `hasFocusedElement`: it only ever separates "nothing focused" from
"something focused that writes no configuration", so a caller with no focus notion at all can derive
it from the path and get the two reachable answers.

## Pattern 4: Make a list item selectable

A list item — a chip, a row, anything with add-and-remove semantics — can be marked as the thing the
column is describing, without that gesture also changing the configuration. Read
[selection.md](./selection.md) first for why this is a separate idea from membership; this is the
mechanics.

**Nearly all of it is already done.** The click and focus writers are two `document` listeners
mounted once by the provider, and they resolve outward to the nearest anchor. So a component that
carries an anchor is **already selectable** — by pointer, by keyboard, and on Safari. There is
nothing to wire.

What is left is the visible half. Two lines:

```tsx
// Inspected is the store alone — never `&& selected`. SF-17 / INV-1: an unselected
// chip must still be able to show as inspected; `anchorItemExists` already drops a
// truly deleted subject.
const inspected = useIsInspected(configAnchor);

<span
  data-config-anchor={configAnchor}
  aria-current={inspected ? 'true' : undefined}
  className={cn(base, inspected && 'ring-1 ring-primary')}
>
  {children}
</span>;
```

Four rules, each with a silent failure behind it:

1. **Put both on the element that carries the anchor.** One element, one truth. Mirroring
   `aria-current` onto an inner button gives you two carriers that can disagree after any edit.
2. **Do not gate the marker on membership / deploy-selection.** Restoring `&& selected` hides
   inspected state on the exact case claim-topic selection makes reachable — an unselected topic
   that remains in the array and stays inspectable. Deletion is handled at read time by
   `anchorItemExists`, not by conjugating the marker with `selected`.
3. **Do not add `tabIndex`, a `role`, or `aria-selected`.** None is needed and each has a cost; see
   [accessibility.md](./accessibility.md#selecting-a-list-item-by-keyboard).
4. **If the item is created by an Add handler, call `inspect` in that handler.** The code that
   performs the add is the only code that knows what was created; focus cannot tell you, because the
   Add button's own anchor names the slot _one past_ it.

```tsx
const inspect = useInspectAnchor();

const handleAdd = useCallback(
  () => {
    onAddCustom(created);
    inspect(claimTopicAnchor(created.id)); // written, not inferred from where focus went
    reset();
    document.getElementById('the-first-field')?.focus(); // repeat entry
  },
  [
    /* … */
  ]
);
```

**Do not reorder those four lines to fix an ordering bug.** The document listener also fires for this
interaction and resolves the Add button to a draft anchor; the direct write survives because
`inspect` **refuses** draft anchors, not because of when it runs. It genuinely runs before the
listener in one of the app's two add flows and after it in the other, and both are correct. See
[selection.md](./selection.md#the-two-add-handlers-and-why-the-refusal-is-doing-the-work).

**And removing the item needs no code at all.** Do not add a clear to the remove handler: the subject
stops naming a removed item at read time, and an event-driven clear is unwritable anyway, because
React fires no event when it unmounts a focused element.

If the component is under the structural markup guard, adding `data-config-anchor` and `aria-current`
means re-freezing it. That is the guard's own workflow and not this feature's.

## Verifying the layout

The unit suite cannot see any of it. It runs in happy-dom, which has no layout engine and no
container queries and reports zero for every measurement, so a visibility assertion there answers a
question the environment cannot see. A test enforces the prohibition rather than leaving it to
review.

What verifies the layout is a browser probe driving the real built app over the DevTools protocol:

```bash
pnpm --filter @openzeppelin/rwa-wizard-app build
node apps/rwa-wizard/scripts/layout-probe.mjs
```

**Build first, always.** The probe serves `dist/` through `vite preview`, so without a fresh build it
reports the **previous** build and says nothing about your working tree. This is not a theoretical
footgun: running it before the build once reproduced an already-fixed failure with the identical
diagnostic text, while the browser-free reproduction of the same walk passed — which reads as "the
fix does not work in a real browser" and is completely wrong.

Twelve checks. The ones worth knowing by name:

| Check                     | What it asserts                                                                   |
| ------------------------- | --------------------------------------------------------------------------------- |
| `checkGeometry`           | Six configurations; the code pane is never below 586px; nothing overflows         |
| `checkThreshold`          | Binary-searches the switch point and derives it from the **measured** rail widths |
| `checkScrollOwnership`    | The column scrolls itself and the sheet body never scrolls                        |
| `checkHeadings`           | The file heading stays pinned at offset 0; a long path's leaf renders whole       |
| `checkHeightFloor`        | Every clause still holds at the drawer's smallest height                          |
| `checkRevealAtNarrowPane` | Activating the widest range lands visibly in the short pane                       |
| `checkFocusReachability`  | Tab reaches the column when shown and skips it entirely when suppressed           |

And two more invocations, which matter more than the first:

```bash
PROBE_SELF_CHECK=1 node apps/rwa-wizard/scripts/layout-probe.mjs
PROBE_NEGATIVE=1   node apps/rwa-wizard/scripts/layout-probe.mjs
```

- **The self-check** forces the two most important assertions to fail before either is trusted. A
  guard nobody has watched fail is not evidence.
- **The negative run** points the probe at a page without the column. It must fail **closed**,
  naming the missing precondition, rather than reporting green. This is not hypothetical: run
  against a build with no column, a naively written "the code pane is at least 586px" check passes
  everywhere — with only two regions the pane is far wider than the floor at every width. It would
  have reported green against a build that does not have the feature at all.

All three run in CI as one step after the build. Until kit SF-9 lands they are
`continue-on-error` (same advisory gate as the app `Test` step): under the registry pin the drawer
never mounts, so a hard probe gate cannot pass. Package lint/test stay hard.

## Common mistakes

- **Writing the threshold as a literal you chose.** It is `tree + column + code-pane floor`. Write
  the arithmetic in the comment and let the probe check the identity against the measured rails.
  See [layout-rule.md](./layout-rule.md#changing-one-of-the-three-numbers).
- **Writing the container query against a viewport width.** It fires 32px early and shows the column
  at widths where the code pane is already below its floor. Nothing overflows and nothing throws.
- **Merging the two "nothing to show" states.** One of them would then be false for a real control
  in the wizard.
- **Re-indexing rows inside each partition.** The first primary and the first secondary row collide
  on one key; activating a row under _Mentions_ reveals a different site. Only reproduces
  for files with mixed significance.
- **Spreading `latchProps` on an inner element.** The capture-phase pointer handler must be on the
  root, or a click on a row renders one frame with no rows in it.
- **Adding a second file-hiding rule here.** File hiding is the provenance seam's, asked once
  upstream. A second one diverges the day a generator adds a file kind, and the user sees a file in
  the tree that the column claims their field does not touch.
- **Asserting the column's visibility in a unit test.** Prohibited, and enforced by a scan — the
  environment cannot answer the question.
- **Hard-coding a user-visible string.** All of them live in `@openzeppelin/rwa-wizard-copy`,
  including the accessible names, which is where a hard-coded string is least likely to be noticed.
- **Writing a reachability test that starts inside the column.** It cannot discover that the column
  is unreachable; it has already arrived. See
  [accessibility.md](./accessibility.md#the-rule-worth-keeping).
- **Running the layout probe without building first.** It reports the last build. Every probe result
  in this document assumes a build immediately before it.
- **Reordering an Add handler to fix a selection bug.** The refusal of draft anchors is what makes
  both of the app's opposite handler orderings correct. A reorder removes the protection silently and
  leaves a bug that reproduces on one of the two forms.
- **Adding `tabIndex` to a list item.** `tabIndex={-1}` is harmless and invites `tabIndex={0}`, which
  puts every issuer row in the tab order. Nothing here needs an element to be focusable in order to
  be selectable — and happy-dom will focus an unfocusable element, so the unit suite cannot tell you.
- **Mirroring `aria-current` onto an inner button.** Two carriers of one truth, which drift apart at
  the next edit.
- **Putting "which item is selected" in `RWAConfig`.** It is a presentation distinction. In the schema
  it becomes every generator's input, and it changes the generated output.
- **Adding a kit prop without adding it to the ambient declarations.**
  `src/openzeppelin-ui-preview-subpaths.d.ts` declares the kit's unpublished subpath exports, and a
  script-file `declare module` **shadows the package's own types even when the package resolves
  them**. So a new prop used on a kit component fails the plain `tsc` pass while the real-kit pass
  accepts it — the two passes disagree, and the one that fails is the one reading the stub. Add the
  prop in both places. This is the confusing half of that file's own contract, and it is why
  `pnpm typecheck` runs two passes rather than one.
