# Field Impact Column

> A persistent third region in the wizard's code-preview drawer, listing the generated files and
> line ranges determined by whichever configuration location is currently selected. It lives in the
> drawer, not in the form, and what it adds to the wizard's markup is one identifying attribute per
> control and one ARIA attribute on the item it is describing.

## Overview

This is for whoever maintains the RWA Wizard app: the person adding a control to a wizard step and
wondering why it does or does not appear here, the person porting the drawer to the next chain, and
the person who has to change one of the three numbers the layout rests on.

The column answers one question — _which generated code does this field determine?_ — for the
configuration location currently selected, which by default is whatever has focus. It reads the provenance the codegen package recorded, groups it by file,
and turns each attribution site into a row you can activate to reveal that range in the code pane
beside it. It computes no provenance of its own: significance, staleness, file hiding and range
extents all arrive from upstream, already decided.

Two things it deliberately is not. It is **not a popover or a tooltip**: nothing about it is
anchored to a field, and there is no dismiss. And it is **not persistent**: nothing is stored, there
is no storage key to seed or migrate, and a reload starts from "no field selected".

It does carry one piece of live state, and it is worth knowing where it lives. Which location the
column describes is held above the drawer rather than inside it, so it survives closing and
reopening the preview. It is dropped when the wizard step changes, when the active draft changes, or
on a session reset — and it dies with the page. See [selection.md](./selection.md).

The integration point is one component with four props:

```tsx
<PreviewImpactColumn
  config={config}
  provenance={provenance}
  onReveal={onReveal}
  drawerOpen={open}
/>
```

### Why it lives in the drawer

Two earlier attempts put this affordance next to the field it described — an anchored popover, then
an inline panel. Both were correct, both were tested, and both were wrong for the same reason. When
the form was tight, the affordance overlapped the controls beside it; when the form was spaced
enough to fit it, it opened visible gaps between chips and inline inputs that were there whether or
not anyone had asked a question.

The lesson generalises past this feature: **an affordance that lives inside the form competes with
the form.** Every position is either too close to something or paid for by permanent space. The
drawer already exists, it is already the place the user looks at generated code, and it has room
for a rail. So the column went there, and the wizard's own markup gained only the
`data-config-anchor` attributes that let a control be identified, plus — on the two list items that
can be selected — an `aria-current` and one ring utility.

## Quick Start

The column is already wired into the drawer. To render it somewhere else, or to understand the
wiring you are looking at, it needs four values — three from `useCodePreview` plus the drawer's
open flag:

```tsx
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { RevealInPreview } from '../CodePreviewRevealContext';
import { PreviewImpactColumn } from '../components/PreviewImpactColumn';
import type { CodePreviewProvenance } from '../provenanceState';

export function ThreeRegionRow(props: {
  readonly config: RWAConfig;
  readonly provenance: CodePreviewProvenance | null;
  readonly onReveal: RevealInPreview | null;
  readonly drawerOpen: boolean;
  readonly treeVisible: boolean;
}) {
  const { config, provenance, onReveal, drawerOpen, treeVisible } = props;
  return (
    // `data-tree-visible` is the whole seam between React and the width rule.
    <div className="rwa-code-preview flex min-h-0 flex-1" data-tree-visible={treeVisible}>
      {/* file tree, then code pane, then: */}
      <PreviewImpactColumn
        config={config}
        provenance={provenance}
        onReveal={onReveal}
        drawerOpen={drawerOpen}
      />
    </div>
  );
}
```

Three things about that snippet are load-bearing, and each has cost someone an afternoon:

- **The column is mounted unconditionally.** No width test, no `treeVisible` test, no row-count
  test. Whether it is _visible_ is decided by CSS alone; see [layout-rule.md](./layout-rule.md).
- **`data-tree-visible` must stringify.** React renders `data-*` values including `false`, so this
  emits the literal `"true"` / `"false"` the container query matches. The idiomatic
  boolean-attribute refactor (`treeVisible ? '' : undefined`) is right for a presence-tested
  attribute and wrong here: the selector stops matching, the column shows at every width, and at
  900×700 with the tree open the code pane silently drops to 328px with nothing overflowing and
  nothing thrown.
- **It is the third child, after the code pane.** DOM order is reading order is tab order.

## Key Concepts

**The width budget.** The column is a 260px rail that yields to the file tree when both cannot fit
beside a code pane at its floor. The threshold is not a chosen breakpoint — it is the arithmetic sum
of the two rails and the floor, and it is measured rather than trusted.
See [layout-rule.md](./layout-rule.md).

**The view.** Everything the column can be is one closed union of eight shapes: seven resting states
and the list. The component switches over it with a `never` arm, so a ninth state fails
compilation at the render site rather than rendering a blank rail. See [states.md](./states.md).

**Freshness is a mark, not a teardown.** While a regeneration is in flight the rows stay and the
answer carries `stale: true`. They are safe to keep because the rows and the code pane come from the
same committed generation; what has moved on is the draft, which is not on screen yet. Tearing them
down was the first design, and it blinked the column once per keystroke. Activating a row in that
window splits: the file is revealed at once, and the range is re-resolved against the tree that
actually arrives.

**Selection is separate from membership.** Which location the column describes is its own piece of
state — the _inspected anchor_ — and not a side effect of what is in the configuration. Before that
separation existed, a custom claim-topic chip was "selected" precisely because it existed, so the
only gesture that could deselect one was the gesture that deleted it. The subject is a
`ConfigAnchorKey` rather than a `ConfigPath`, which is what makes an index shift a non-event, and it
is written by two `document` listeners rather than by a handler on each component.
See [selection.md](./selection.md). Whether a claim topic _deploys_ is a different meaning of
"selected", owned by the published config type and projected by generators; see
[claim-topic selection](../../claim-topic-selection/README.md).

**The latch.** Activating a row with the pointer moves focus out of the input the column is
describing. The latch is what keeps the column describing that field anyway — interacting with the
column must not erase the answer it exists to show. See [latch.md](./latch.md).

**Significance is presentation.** Rows arrive already marked primary or secondary by the generator.
The column partitions them for rendering and reads nothing else — not line text, not file
extension, not path spelling. A file's primary rows render exactly as they would if the generator
declared no significance at all; the secondary heading and its list are the only things a secondary
row adds.

## Documents

| Document                                       | What it covers                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| [layout-rule.md](./layout-rule.md)             | The yield rule, the derived threshold, and how to change it         |
| [states.md](./states.md)                       | The eight view kinds, their order, and the copy rule they carry     |
| [selection.md](./selection.md)                 | Choosing which location the column describes, without destroying it |
| [latch.md](./latch.md)                         | Keeping the described field across a pointer activation             |
| [accessibility.md](./accessibility.md)         | The keyboard route and the naming contract                          |
| [api-reference.md](./api-reference.md)         | Every export, with full signatures                                  |
| [integration-guide.md](./integration-guide.md) | Wiring, making a control resolvable, and verifying the layout       |
| [known-limits.md](./known-limits.md)           | What degrades, what is deliberately not fixed, and where it lands   |

The provenance the column reads is documented on the other side of the seam, in
[docs/codegen-core/provenance](../../codegen-core/provenance/README.md). Claim-topic _deployment_
selection — defined but not selected, and how generators project that away — is documented in
[docs/claim-topic-selection](../../claim-topic-selection/README.md).

## Safety

Everything here has a failure that is silent — no throw, no log, no red test — which is why each one
is written down rather than left to review.

- **The threshold is arithmetic, never a literal.** It is `tree + column + code-pane floor`. The
  floor is the code pane's measured width at the narrowest viewport the drawer is usable at today,
  so at the switch point the code pane is exactly as wide as it is right now. Change any of the
  three and the threshold moves with it. A test asserts that identity against the _measured_ rail
  widths, so the number cannot drift from the comment that explains it.
- **The query measures the container, not the viewport.** The drawer body insets the three-region
  row by 32px, so a rule written against a viewport figure fires 32px early — showing the column at
  widths where the code pane is already below its floor. Nothing looks broken when this is wrong.
- **The two "nothing to show" states must not converge.** One speaks about attribution and never
  about effect; the other is the only string permitted to claim anything about the generated code.
  The wizard contains a control that changes the generated tree and still correctly resolves to no
  configuration path, and a merged string would be plainly false for it. See
  [states.md](./states.md#the-two-empty-states-and-why-their-copy-may-not-merge).
- **A held field name never outlives the draft it was resolved against.** The column's subject is an
  anchor, re-resolved every render, so it has no stored index to go stale. The one path the latch
  still remembers is dropped when the draft object it was armed against is replaced. Both are
  properties of this feature, not of the app — the earliest form depended on how every caller happens
  to write drafts, and that dependency failed. See
  [latch.md](./latch.md#what-most-of-the-latch-became).
- **A body click on a list item may not destroy it.** Selecting and deleting are separate gestures:
  the `×` is the only removal. The failure this replaced was silent in the worst way — the user made
  the gesture that means "tell me about this" and lost the thing they were asking about. See
  [selection.md](./selection.md).
- **An add handler writes the subject directly, and the write survives because a competing write is
  refused — not because it is early.** The two add flows in the app have opposite orderings relative
  to the document listener, and both are correct. A future author who fixes an ordering bug by
  reordering will find that the refusal was doing the work.
- **Row keys carry the index from the unpartitioned row list.** Re-indexing inside each partition
  makes the first primary and the first secondary row collide on one key; React reuses one row's
  node for the other, and activating a row under _Mentions_ reveals a different site. It
  only reproduces for files with mixed significance, and nothing throws.
- **The column persists nothing and reads no storage.** Its visibility is a function of the
  container width and the file-tree preference that already exists. There is no key to seed,
  migrate or version.
- **Every user-visible string comes from `@openzeppelin/rwa-wizard-copy`.** That includes the
  accessible names, which is where a hard-coded string is least likely to be noticed.
- **No unit test may assert the column's visibility.** The suite runs in happy-dom, which has no
  layout engine and no container queries — a `toBeVisible` there answers a question it cannot see.
  Visibility, geometry and the threshold are the browser probe's; see
  [integration-guide.md](./integration-guide.md#verifying-the-layout).
- **The refresh signal must never displace anything.** It flips on every keystroke, so it is
  `aria-busy` plus a delayed CSS fade — no node added, no height change, no content swap, and no JS
  timer. A signal that reflowed the column would be worse than no signal.
- **Activation reveals once, and a `created` row never synthesises a line jump.** Telling a user
  that a field created a file _at line 1_ is a claim the generator never made, and it is wrong for
  every file that opens with a licence header.

## License

AGPL-3.0 — OpenZeppelin
