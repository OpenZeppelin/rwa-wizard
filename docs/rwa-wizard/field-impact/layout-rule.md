# The Layout Rule

> One responsive rule, expressed entirely in CSS, deciding one thing: whether the impact column is
> on screen. Its threshold is derived arithmetic — never a chosen breakpoint — and it is measured in
> a real engine rather than reasoned about.

[README.md](./README.md) says what the column is. This page is the part of it that could not be
settled by argument, because the drawer has no responsive infrastructure to inherit: its tree rail
is a fixed unconditional width, nothing in the app asserts a viewport size, and the test suite runs
in a DOM with no layout engine at all.

## The rule, in one line

> **The column is present unless the file tree is present and there is not room for both beside a
> code pane at its floor.**

With `W` the inline size of the three-region row:

|                  | `W ≥ 1126px`      | `W < 1126px` |
| ---------------- | ----------------- | ------------ |
| file tree shown  | tree **+** column | tree only    |
| file tree hidden | column            | column       |

The file tree's behaviour is unchanged at every width. The only new rule is on the column, it has
one direction, and it is a pure function of the container width and the tree preference with no
state anywhere.

## The threshold, derived

```
threshold = tree width + column width + code-pane floor
          = 280        + 260          + 586
          = 1126px
```

**Never write 1126 as a number you chose.** Each term is a fact about the shipped drawer:

- **280px** is the file tree rail, fixed and unconditional today.
- **260px** is the column, wide enough for a two-line file heading and a `Lines 201–219` row.
- **586px** is the code pane's measured width at 900×700 in the drawer as it ships **without** this
  feature — the narrowest the drawer is usable at today.

That third term is why the derivation matters rather than the total. Because the floor is the
status quo, **at the switch point the code pane is exactly as wide as it is today**. The rule does
not decide how much code the user is entitled to; it declines to take any of it. Above the
threshold the column is paid for out of space the code pane did not need, and below it the column
is what goes.

If any of the three moves, the threshold moves with it by arithmetic. The browser probe asserts
that identity against the **measured** rail widths on the page rather than against the constants in
the comment, so the number cannot drift silently from its own explanation.

## Why a viewport number would be wrong

The equivalent viewport figure is `1126 + 32 = 1158px`, where the 32 is the drawer body's `px-4`
inset. Both numbers are correct; only one of them belongs in the CSS.

The rule is a **container query on the three-region row**, so it measures the row, not the window.
Written against the viewport figure it fires **32px early**: between a container width of 1126 and
1158 the query still reports "wide", the column stays on screen, and the code pane is already below
its 586px floor. That band is 32 pixels of a layout that has quietly stopped honouring the one
number the whole rule is built on — and it looks completely normal, because nothing overflows and
nothing throws.

The first measurement of the real box model is what produced this correction. An analysis done from
viewport widths alone had the number 32px too high, and the mistake survives review comfortably
because both figures are real measurements of real things.

## Why the column yields, and not the tree

Below the threshold exactly one rail fits. The column is the one that goes, for reasons in order of
weight:

1. **It takes nothing away.** Making the column the default rail would silently remove the file
   tree at 900×700 and 1024×800 for every user whose stored preference is the default — they open
   the drawer and yesterday's tree is gone, replaced by a list they did not ask for, against a
   preference they had already expressed. Under this rule nobody's layout changes until they change
   it.
2. **The tree toggle stays honest for free.** "Show file tree" / "Hide file tree" and its pressed
   state remain literally true at every width. A swap would make the control mean two different
   things on either side of a breakpoint, and relabelling it would mean teaching React the
   threshold.
3. **It keeps the rule CSS-only.** A swap needs React to know the breakpoint so it can relabel the
   control. A yield does not need React to know anything.
4. **The persistence rule stays "the column persists nothing."** Its visibility is a function of the
   container width and the tree preference that already exists — no second storage key to seed,
   migrate or version.
5. **Nothing the user already had is ever removed by a rule.** The only region the rule can take is
   the one this feature adds, and it leaves either because the user pressed the tree toggle or
   because the user resized the window. Neither is a surprise, so nothing needs announcing.

**The cost, stated plainly.** Below a container width of 1126px, a user who keeps the file tree open
never sees the column, and nothing on screen tells them it exists. That is real, and it is a
deliberate divergence from "always present, not dismissible" rather than an oversight — it diverges
only in the region where three regions provably cannot coexist. Three things bound it: the common
desktop viewports (1280, 1440, 1512, 1920) are all above the threshold, so the column is there by
default for most users on first load; the control that reveals it is already in the drawer header
with a visible icon and a tooltip; and the alternative costs an existing user their file tree
without asking. See [known-limits.md](./known-limits.md#below-the-threshold-with-the-tree-open).

Narrowing the column instead does not help, and the arithmetic says so in one line: at 900×700 the
container is 868px, so `280 + C + 586 ≤ 868` gives `C ≤ 2px`. Three regions do not fit at 900 at
_any_ column width.

## The mechanism

The column is suppressed with `display: none`.

```css
.rwa-code-preview {
  container-type: inline-size;
  container-name: rwa-preview;
}

@container rwa-preview (width < 1126px) {
  .rwa-code-preview[data-tree-visible='true'] .rwa-code-preview-impact {
    display: none;
  }
}
```

The file tree hides itself differently — it animates its width to zero and sets `inert` and
`aria-hidden`, keeping the subtree mounted so the tree component's expansion state survives. That
mechanism cannot be reused here, and the reason is precise: `inert` and `aria-hidden` are
_attributes_, so only React can set them, and React does not know the threshold. `display: none` is
the CSS-expressible equivalent — it removes the subtree from layout, from the tab order and from
the accessibility tree in one declaration. The tree's own mechanism is untouched and keeps working
exactly as it does today; the column holds no state, and `display: none` keeps it React-mounted
anyway.

Two costs, named rather than discovered later:

- **No transition.** The tree animates out over 200ms while the column appears at once. Cosmetic,
  one frame.
- **No React notification.** If focus is inside the column when a window resize crosses the
  threshold, focus drops to `<body>` and the user presses Tab to get back. Buying recovery means a
  `ResizeObserver`, a boolean, a teardown and a "not yet measured" initial value — a state machine
  for one keystroke in a rare case. Not bought; see
  [known-limits.md](./known-limits.md#focus-after-a-resize-across-the-threshold).

The last of those is also why the rule is not a `ResizeObserver` feeding a React boolean. That
approach buys a swap-capable toggle and focus recovery, and costs an initial "unmeasured" width
that reads as **0 in happy-dom** — so the entire unit suite would run the narrow branch while every
real desktop runs the wide one. A test environment that silently exercises the opposite branch is
worse than no test at all.

There is no hysteresis band. It is not expressible in a stateless CSS rule, and the flap it would
prevent requires a user to wiggle the window edge across a one-pixel boundary. The drawer is
full-width, so its width changes only on window resize — never on the height drag users actually
perform.

## Changing one of the three numbers

If you widen the tree rail, change the column width, or decide the code pane's floor is somewhere
else:

1. Change the constant at its source. The rail widths are read from the page by the probe, so a
   width changed in one place and not the other is a probe failure, not a silent skew.
2. Recompute the threshold as the sum and put **that** number in the container query, with the
   arithmetic in the comment above it. Do not carry the old number forward.
3. Run the probe. `checkThreshold` binary-searches the real switch point and compares it against
   the sum of the rails it measured on the page. A mismatch fails and prints both numbers.
4. Check the viewport figure has moved too if you quote it anywhere — it is the container figure
   plus the drawer body's inset, and the inset is not part of the rule.

## How the rule is verified

None of this is verifiable in the unit suite: happy-dom has no layout engine, no container queries,
and reports zero for every measurement. Asserting the column's visibility there answers a question
the environment cannot see, so the suite is forbidden from trying and a test enforces the
prohibition.

What verifies it is a browser probe driving the real built app over the DevTools protocol. It
measures six configurations (three viewports × tree shown/hidden), asserts the code pane is never
below 586px in any of them, binary-searches the switch point and derives the threshold from the
rails it measured, and confirms nothing overflows. It also runs itself two more ways: a self-check
that forces the two most important assertions to fail before either is trusted, and a negative run
against a page without the column, which must fail closed naming the missing precondition rather
than reporting green. See
[integration-guide.md](./integration-guide.md#verifying-the-layout).
