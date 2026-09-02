# Known Limits

> What this feature does not do, stated where a reader will hit it rather than discovered. Each item
> says what degrades, why it was not fixed here, and where the fix belongs if there is one.

## Reveal geometry in the narrow drawer

**What happens.** Activating a row reveals the range in the code pane. The kit's reveal behaviour
was verified against a 455px-tall pane; the drawer gives it **203px at 900×700**, while real
generated ranges span 6, 19, 34 and 25 lines. At the code font's 12px and a 19.2px line box that is
about **10.6 lines**, so **a 34-line range shows roughly a third of itself**. The reveal is centred,
so what you see is the middle of the range and neither end.

The font reduction from 14px to 12px bought headroom here — the same pane showed about 8.9 lines
before — but it changed the arithmetic rather than the limit.

**Why nothing here fixes it.** The reveal _behaviour_ is the drawer's and it is correct; the reveal
_geometry_ is the code view's and lives in the kit. The three things this feature could have done
are all worse than nothing:

- Auto-maximising the drawer on activation is precisely the "very distracting to have the UI shift
  just because I clicked" failure that killed the two earlier attempts at this affordance.
- Asking for a one-line range instead of the real one would discard the extent the generator
  reported — the column would stop telling the truth about how much code the field determines.
- Re-implementing scroll alignment over the kit's would fork a contract that was verified upstream.

**What is guaranteed instead.** The probe asserts the reveal still lands **visibly** at the narrow
pane: after activating the widest available range at 900×700, the marked range's first line is
inside the pane's visible box. So it degrades gracefully rather than scrolling to nothing.
Degradation verified; degradation not fixed.

**Where the fix belongs.** A reveal alignment option on the kit's code view — scroll the range's
_start_ to the top rather than centring the range — so a range taller than the pane shows its
beginning. That is a kit change and should be raised with the kit maintainers rather than worked
around here.

**The mitigation that already exists.** Maximise, one click away in the same drawer header.

### Why the reveal context gap stays at two lines

The gap above a revealed range is **2 lines**, and the font reduction was not enough to spend on a
third. The arithmetic, at the default pane:

```
pane                409px
line box            19.2px
visible             409 / 19.2      = 21.3 lines
2lh gap leaves      21.3 - 2        = 19.3 lines of range
3lh gap leaves      21.3 - 3        = 18.3 lines of range
the range in hand                     18 lines
break-even for 3lh  (18 + 3) * 19.2 = 403.2px
margin              409 - 403.2     = 5.8px
```

**5.8px of margin, against a sheet whose persisted height floor is 160px.** A third line fits the
default pane and stops fitting almost immediately after it. That is the number to quote if this
comes up again, rather than a judgement about how much context feels right.

## Below the threshold with the tree open

**What happens.** At a container width under 1126px, a user who keeps the file tree open never sees
the column, and nothing on screen tells them it exists.

**Why it is deliberate.** Three regions provably do not fit: at 900×700 the container is 868px, and
`280 + C + 586 ≤ 868` gives `C ≤ 2px`. One rail has to go, and making it the tree would silently
remove a panel the user had already chosen to keep, against a preference they had expressed. See
[layout-rule.md](./layout-rule.md#why-the-column-yields-and-not-the-tree).

**What bounds it.** The common desktop viewports — 1280, 1440, 1512, 1920 — are all above the
threshold, so the column is present by default for most users on first load. The control that
reveals it is already in the drawer header with a visible icon and a tooltip. And the user who is
below the threshold is the user who most needs their code pane intact.

**What it is not.** It is a knowing divergence from "always present, not dismissible", not an
oversight, and it diverges only in the region where the requirement cannot be satisfied without
destroying the code pane.

## Focus after a resize across the threshold

**What happens.** If focus is inside the column when a window resize crosses the threshold, the
column is removed with `display: none` and focus drops to `<body>`. The user presses Tab to get
back into the document.

**Why it is not handled.** React is not notified, because the rule is CSS. Recovering focus means a
`ResizeObserver`, a boolean, a teardown, and an initial "not yet measured" value — a state machine
for one keystroke in a case that requires resizing the window while focus is parked in the column.
The observer would also make the entire unit suite run the narrow branch, because an unmeasured
width reads as 0 in happy-dom.

## Not virtualised

The measured worst case is 26 sites across two files for one field, and the column scrolls for it at
every viewport including 1280×900 — so the scroll region and the sticky heading are the ordinary
path, not a narrow-viewport nicety. **No rows are truncated or hidden**; the answer to a long list
is the scroller, not a "show more".

At 26 rows, a windowing dependency would add a measurement dependency and a keyboard hazard for
nothing. If a generator ever attributes an order of magnitude more sites to one field, this is the
decision to revisit.

## The drawer's smallest height

The drawer can be dragged down to a 160px floor, where the whole three-region row is 36–54px tall.
There is **no special mode** for it, deliberately: an extra height-driven state is a state to hold
correct, and a 14px scroller is no more useful than the 22px code pane beside it. The drawer at its
floor is a drawer someone deliberately shrank, and maximise is in the same header.

What still holds there, by construction rather than by luck: the field header does not scroll (it is
outside the scroll region), it is one line so it does not clip, the scroller takes what is left and
has no minimum height so it collapses rather than forcing the sheet body to scroll, and nothing
overflows. All of that is measured at the floor by the probe rather than assumed.

## The dim foreground fails AA

**What happens.** `--rwa-code-preview-fg-dim` (`#5c6370`) on the panel ground
(`--rwa-code-preview-sidebar-bg`, `#21252b`) measures **2.55:1**. WCAG AA wants 4.5:1 for small text
and 3:1 for large text and non-text UI. **It clears neither**, so the shortfall is not confined to
small text.

The population at that level was re-measured after the prose-to-glyph pass, because that pass moved
which elements sit there rather than changing the token. As it stands: the file heading and its
directory line, the header glyph, the context crumb in the header, the `Mentions` heading, secondary
row labels, and the row's arrow. The rendered secondary sentence left the list — it is a tooltip
now — and the arrow joined it. Two of these are glyphs rather than text, and as non-text affordances
their bar is the lower 3:1, which 2.55 also misses.

**Why it was not fixed here.** The token is pre-existing, it is shared with the file tree beside the
column, and it is Atom One Dark's own value copied verbatim under a test that pins the theme against
upstream. Changing it is a theme decision affecting the whole drawer, not a change one region should
make on its own.

**What bounds it.** Nothing that carries meaning alone sits only at this level. Primary versus
secondary is carried by the heading word, not by tone. The arrow duplicates an affordance also
announced by the row being a real button with a visible focus ring. The field name in the header,
the file leaf and primary row labels all use the full-strength foreground. The dim token is doing
emphasis and grouping work, not sole-signal work.

**Where the fix belongs.** A theme-level decision on the dim token for this surface, taken with the
file tree in view and the theme-diff test updated deliberately rather than incidentally.

### The line-number gutter is better, and still short

The gutter that now renders beside the code has its own token,
`--rwa-code-preview-gutter` (`#7f848e`), measuring **3.73:1** on the code-pane ground (`#282c34`).
That clears the 3:1 non-text bar but **not** the 4.5:1 bar — and line numbers are text. So it is a
real improvement on the 2.55:1 it would otherwise have inherited, not a fix.

## The pending location now has `uncreated`

**What used to happen.** A control can name a configuration location that **resolves but does not
exist yet** — an operator role with no addresses, a pending trusted issuer, a draft Add slot.
Prefix matching against parent-collection provenance would falsely populate rows. `empty` claims
"no generated file depends on this field's value", which is false for a slot that has not had its
turn. `pending` means the tree is mid-rebuild.

**What happens now.** `FieldImpactView` includes `uncreated`: when the path resolves in the anchor
layer but `resolveConfigPath` reports it absent from the live draft, the column shows that resting
state (copy: "Not added yet") instead of inventing rows. See [states.md](./states.md#uncreated--a-resolvable-path-the-draft-does-not-hold-yet).

The latch still keeps naming the slot across a reach into the column; `uncreated` is what the view
says about it once the path is known and the draft still lacks the item.

## The selection ring borrows the focus vocabulary

**What happens.** An inspected chip or issuer row is marked with `aria-current="true"` and a
one-pixel `ring-1 ring-primary`. Everywhere else in this app, `ring-*` is the **focus** indicator —
the column root has one, the rows have one, the drawer's own controls have one. So a persistent ring
on a chip may read as "this is focused" rather than "this is what the column is describing", and on
an issuer row it says it about a `<div>` that deliberately cannot be focused at all.

**What is known.** The two cues are at least distinguishable from each other: the chip's ring is
offset off its border precisely because an unoffset one doubled the `border-primary` a selected chip
already has. That was a real defect and it is fixed. What is **not** settled is whether the resulting
mark reads as _selection_ to someone who has learned this app's focus vocabulary.

**Why it is open rather than decided.** It cannot be settled without a real screen. The situation
that matters is three or four custom chips and two issuer rows visible at once, in both themes, with
focus somewhere among them — which is a judgement about a rendered composition, not a property a test
can hold. Nothing here is measurable in the way the contrast ratios above are.

**Where the fix belongs, if one is wanted.** Changing the token touches no invariant and needs no
re-freezing of the guarded markup, so it is a one-line change once someone has looked. The
constraints on any replacement: it must not be colour alone, it must not introduce a second
colour-carrying signal into the preview composition — the reveal accent is the only one — and it must
come from the kit's tokens.

## Untested surfaces

Mobile, touch, zoom, OS text scaling and internationalisation are out of scope upstream and are not
tested here. The column is a fixed 260px rail with fixed type sizes; none of those surfaces has been
measured against it.

## One property that is pinned rather than held

The latch was originally designed with no guard, on the argument that a held field name cannot
outlive the draft it names because **every** draft change goes through a control outside the column.
That argument was written down as a checkable property — no code in the app mutates the draft
configuration outside a control's event handler — and it is **false of the app**: four pre-existing
call sites in two hooks write the draft from inside `useEffect` bodies. None is in this feature and
none was introduced by it.

The failure was the documented trigger to guard the latch rather than to weaken the check. The guard
has since become cheaper twice over. The first version stamped the held path with the live generate
key; that stamp is gone, because the column's subject is now an anchor rather than a path and there
is no stored index left to go stale. What remains is the latch's own held answer, which is dropped
whenever the draft object it was armed against has been replaced — a reference comparison, which does
not depend on a hash covering the right fields. See [latch.md](./latch.md#the-draft-is-captured-at-arm-time-not-stored-beside-the-answer).

**So the property is pinned, not held.** The test that stands in its place is a **classifier**, not
a hand-maintained list: it enumerates every draft-mutating call site in the app, decides
structurally whether each is inside an effect, and compares the non-interactive set against a table
of the four declared sites, each with the reason it is safe. That test passes today. A **new**
non-interactive mutation — a new file, or one more site in a declared file — fails it on the day it
lands, with a message naming what to verify before declaring it. The classifier itself is tested
against a fixture with one mutation inside an effect and one inside a handler, because a classifier
that always answered "interactive" would make the table trivially satisfied.

Read plainly: nothing asserts the original property, because it is not true. What is asserted is
that the set of exceptions has not grown without someone looking at it.

## Drawer preferences in localStorage

The five drawer chrome preferences (open, height, width, tree visibility, dock edge) live in `localStorage`, not in the app's `@openzeppelin/ui-storage` database. This is a recorded deviation from Principle VI's wording. It is accepted because the values are read synchronously on first render to size the sheet (an IndexedDB hydration would paint defaults and then jump), because every value is a scalar with a total parser and a fallback (the Storage constraint holds), and because nothing there is user data. The rationale is repeated at the top of `previewPersistence.ts` so it travels with the code.

## Cargo.toml attribution differs between the two generate paths

The plain generate path attributes the workspace `[members]` block of `Cargo.toml` per module occurrence (`compliance.modules[i].moduleId`) because it observes each module separately at the composition root. The identity-support path derives the same block from a whole-list `map` over `compliance.modules`, so its range carries the list root together with every occurrence. Both are honest: the identity path genuinely depends on the whole list. The column therefore shows one extra whole-list site for `Cargo.toml` on the identity path. Aligning the two would mean threading the per-occurrence groups into the identity template for no change in generated bytes; it is recorded here rather than done.
