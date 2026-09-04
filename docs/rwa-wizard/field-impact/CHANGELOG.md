# Changelog — field-impact column

This file tracks the field-impact documentation set. The column is part of the wizard app and is not
a published package, so there is no release note to generate from `.changeset/`.

## Unreleased — 2026-08-31

Selection: which location the column describes is now its own idea, separate from what is in the
configuration.

### Added — behaviour

- **A body click on a custom claim-topic chip selects it instead of deleting it.** The `×` is now the
  only way to remove one. This was data loss from the gesture users make to inspect something: the
  chip's `selected` prop was the literal `true` because a custom topic is in the DOM if and only if it
  is in the configuration, so "deselect" and "delete" were the same act.
- **Trusted-issuer rows are selectable at all**, which they were not. Clicking a row's background —
  or tabbing to any control inside it — makes the column describe that issuer. The row gained no
  `onClick`, no `role` and no tab stop.
- **A newly added chip or trusted issuer is selected at creation**, so the column describes it
  immediately, while focus returns to the input for the next entry. The two were previously one
  variable and one had to lose.
- **Selection works on Safari**, including for the nine list-like components that did not change.
  WebKit does not focus a `<button>` on click and pulls focus off whatever was focused before, so
  anything focus-driven emptied the column there.
- **The marker is `aria-current="true"` plus one ring utility**, on the element that already carries
  the configuration anchor. The chip's ring is offset off its border; the issuer row's is not, because
  a chip is always `selected` and an unoffset ring doubled the border it already had.

### Changed

- **The subject is a `ConfigAnchorKey`, not a `ConfigPath`.** It is re-resolved against the live draft
  on every render and existence-checked at read time, so removing an item stops the column describing
  it without any handler doing so, and shifting indices can never make it name a _different_ item.
- **The latch is smaller.** `HeldField`, its generate-key stamp and the render-phase state write that
  kept it current are gone — the anchor removed their premise. What remains is a gate, the last answer
  the column rendered, and the draft in force when the gate opened.
- **`TogglePill.onClick` is optional**, so a chip can be selectable without being destructive. Its body
  stays a real `<button>` with no handler, which keeps custom topics reachable by keyboard.
- **`toFieldImpactView`'s input space is four reachable states rather than three.** No logic changed:
  `{ path: non-null, hasFocusedElement: false }` was unreachable by contract and is now the ordinary
  case for an item just created. It was already handled correctly.

### Fixed

- **Reaching into the column no longer erases the answer for a location that resolves but does not
  exist yet** — a pending operator role, a pending trusted issuer, a deselected predefined topic. The
  column had begun announcing "not a configuration field" about a control that plainly writes
  configuration. Caught by the browser layout probe; no browser-free test could see it, because it was
  a missing case rather than a wrong one.

### Known limitations

- The pending location still has no view state of its own; two mechanisms avoid stating something
  false instead of stating the true thing. Recorded with a standing rule for when that stops being
  acceptable — see
  [known-limits.md](./known-limits.md#the-pending-location-has-no-state-of-its-own).
- The selection ring sits in what is otherwise this app's _focus_ vocabulary, so it may read as
  "focused". Unresolved, and not resolvable without a real screen — see
  [known-limits.md](./known-limits.md#the-selection-ring-borrows-the-focus-vocabulary).

### Migration

The wizard page must mount `InspectedAnchorProvider` above **both** the wizard layout and the
code-preview drawer, with a `scopeToken` and the selected compliance modules. Every consumer hook is
inert without it — deliberately, so the adopted components still render in harnesses and under the
markup guard — which means omitting it ships the feature inert with a green suite.

Three components under the structural markup guard changed and were re-frozen. No user-facing string
was added, no configuration schema field was added, and the generated output is byte-identical.

## Unreleased — 2026-08-30

First documentation set for the column. Everything below is new in this release of the app.

### Added — behaviour

- The **field-impact column**: a persistent third region in the code-preview drawer, right of the
  code pane, listing the generated files and line ranges determined by the input that currently has
  focus. Always present while the preview is open, not anchored to a field, not dismissible.
- **Rows group by file**, primary sites first and unlabelled, secondary sites under an _Also appears
  here_ heading. Activating a row reveals that site in the code pane; a created-file row never
  synthesises a line jump.
- **Six resting states**, each named and distinct: no preview, generator does not record, nothing
  focused, focused control is not a configuration field, regenerating, and resolved-but-empty.
- **Staleness is a mark on the answer**, not a state that replaces it: `FieldImpactView`'s `groups`
  payload carries a required `stale: boolean`, and the rows stay put through a regeneration under
  `aria-busy` and a 400ms-delayed opacity fade. `Regenerating` is reached only when a refresh is in
  flight and there are no rows to keep.
- **A latch** that keeps the column describing the same field across a pointer activation, stamped
  with the live generate key so a held field name never outlives the draft it was resolved against.
- **One static keyboard tab stop** on the column root, which repopulates the rows on arrival so the
  next Tab enters the first one. Rows carry their own visible focus ring.
- **A header that names its subject**: a glyph carrying the region's description as its tooltip,
  beside a humanised config path (`Token · Name`, `Access control · Roles 1 · Addresses`) with the
  raw path on `title`. Produced by `humaniseConfigPath`, which formats data rather than authoring
  copy.
- **A rest-state arrow on every row**, replacing a hover-only affordance that gave a keyboard user
  no signal at all. `aria-hidden`, and an arrow rather than a chevron so it does not read as the
  file tree's expand-a-folder disclosure.
- **A glyph for each of the six resting states**, keyed by the same discriminant as their copy, so a
  seventh state cannot arrive with words and no icon.
- **Split activation during a refresh**: the file is revealed immediately and the range is held and
  re-issued once against the first fresh tree, re-resolved from the rows that tree renders rather
  than replayed. Dropped without a reveal if the field moved on, the file left the tree, or the site
  is no longer a range.
- **File headings in path order** — directory first, then the leaf — so the heading reads as one
  wrapped path rather than two unrelated facts. The leaf is never truncated, and the directory now
  loses its **middle** rather than its end, because end-truncation ate the segment nearest the file.
- **The secondary group is one word (`Mentions`) plus a glyph**, with its explanatory sentence on
  the heading's `title` rather than rendered beneath it.

### Added — layout

- **A container query on the three-region row**, the app's one responsive rule. The column yields to
  the file tree below a container width of `280 + 260 + 586 = 1126px`, and only there.
- **A browser layout probe** (`apps/rwa-wizard/scripts/layout-probe.mjs`), gating in CI, with a
  self-check invocation and a negative invocation.
- **A line-number gutter on the code pane**, themed through `--rwa-code-preview-gutter`, and the
  code font reduced from 14px to 12px.

### Added — copy

Thirteen `notice.code-preview.impact.*` entries in `@openzeppelin/rwa-wizard-copy`, covering the
region's accessible name, the six resting states, the secondary-group heading and its description,
the four row labels and the row's accessible label template.

### Changed

- `CodePreviewDrawer` and `PreviewDrawerBody` each take three new required props — `config`,
  `provenance`, `onReveal` — threaded from the wizard page. Existing call sites must supply them.
- The three-region row now carries `data-tree-visible`, which the container query matches as a
  literal string.

### Known limitations

Documented in [known-limits.md](./known-limits.md) rather than left to be found:

- Reveal geometry degrades in the short drawer pane — a 34-line range in a roughly 10.6-line pane
  shows about a third of itself. The fix is a kit-side reveal alignment option.
- Below a container width of 1126px, a user who keeps the file tree open never sees the column.
- Focus drops to `<body>` if a window resize crosses the threshold while focus is inside the column.
- The draft-mutation property the latch was originally designed against does not hold of the app;
  the identity stamp replaces it and the exceptions are pinned by a classifier.
- The dim foreground token measures 2.55:1 on the panel ground, clearing neither the 4.5:1 bar for
  small text nor the 3:1 bar for non-text UI. It is pre-existing and shared with the file tree.
- The line-number gutter's own token measures 3.73:1 — clearing the 3:1 non-text bar but not the
  4.5:1 text bar, and line numbers are text.

### Migration

Anything rendering `CodePreviewDrawer` or `PreviewDrawerBody` directly must pass the three new
props. Pass `provenance` and `onReveal` behind the **same** condition the preview's provider guard
uses, so `null` keeps meaning "there is no code preview to point at" rather than a second notion of
unavailable. `config` is the live draft.
