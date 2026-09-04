# Accessibility

> The column is reachable by keyboard through one static tab stop on its root, names the field it is
> describing, and carries the primary/secondary distinction in text rather than in colour. The tab
> stop is one line of code, and it nearly did not ship — the reason it was missed is the most
> transferable thing on this page.

## The keyboard route nearly shipped broken

The column's rows were real `<button>` elements from the first draft, in a real list, with no roving
tabindex and no key handling. That is the correct shape, and it was not enough: **walking Tab from
the form never entered the column at all.**

Measured against the real built app, focus went

```
Maximize preview → Close generated code preview → [the code pane] → <body>
```

straight past the three-region row and out of the document. Snapshotting the column one Tab before
it would have been reached:

```
shown=true  rows=0  header=""
text="Field impact | Not a configuration field | This control is not part of the
      configuration, so the generator does not attribute generated code to it."
```

The column was on screen, correct, and **empty** — with nothing focusable to land on.

The mechanism is worth following, because every part of it is behaving as designed. Rows exist only
while a configuration field has focus. Reaching the column by Tab means walking through the rest of
the form and the drawer chrome, and **every one of those stops is an unresolvable control** — the
tree toggle, the maximize button, the close button, the code pane. So by the time the tab order
arrives, the resolved path is long since `null`, the latch gate is closed, and the region has no
children to receive focus. The pointer route always worked, because the capture-phase pointer
handler arms the latch before focus moves. The keyboard route had nothing to arm it.

### The rule worth keeping

The unit test for keyboard operability rendered the list view directly and then tabbed through it.
It passed, and it would have passed forever.

> **A reachability test may not start inside the thing it verifies.** It begins on the far side of
> the question.

That test was correct about everything it asserted — the rows are buttons, they are in DOM order,
they activate. It simply could not see the only failure that mattered, because it had already
arrived. The walk now starts on the focusable **before** the column, asserts the column is showing
zero rows at that moment — the exact state that hid this — and asserts that the next stop is the
column root rather than the element behind the drawer.

## The fix: one static tab stop

```tsx
<section
  className="rwa-code-preview-impact flex min-h-0 shrink-0 flex-col"
  aria-labelledby={`${id}-title ${id}-field`}
  tabIndex={0}
  {...latchProps}
>
  {/* heading, field header, scroller */}
</section>
```

Arriving on the root fires the latch's `onFocus`, which opens the gate, which restores the held
path, which renders the rows — so the **next** Tab enters the first row. It adds no invalidation
input to the latch, because a focus arrival on the column root was already one of its three gate
inputs.

Two things this is not:

- **It is not a roving tabindex.** Exactly one stop, static, on the root, with no
  `aria-activedescendant` and no composite-widget key handling. A roving list is the expensive
  answer to a question nobody asked: the requirement is reachable and activatable, not a listbox.
- **It is not a bare tab stop.** A reachable control with no focus indicator trades one
  accessibility failure for another, so the root has its own `:focus-visible` ring in the column's
  accent, inset so the row's `overflow: hidden` cannot clip it. The light UI's default ring token is
  near-invisible against the dark code surface, which is why the column owns this one.

When the fix landed, the guard that had been written against roving tabindex — "no `tabIndex`
anywhere in this feature" — started failing. It was the guard that yielded, not the fix. The
requirement has a purpose (reachable and operable by keyboard) and the guard was a mechanism chosen
to serve it; they had come apart, and **enforcing the mechanism against its own purpose was the
failure, not the fix.** The guard now reads "at most one `tabIndex`, whose value is `0` and whose
element is the column root", which is the same protection against the actual hazard.

## Naming

The region's accessible name concatenates two nodes:

```tsx
<>
  <h3 id={`${id}-title`} className="sr-only">
    Field impact
  </h3>
  <span id={`${id}-field`}>
    <span>{subject.context}</span>
    <span>{subject.field}</span>
  </span>
</>
```

so it reads _"Field impact Access control · Roles 1 · Addresses"_. The visible field element and the
accessible name are the **same node**, so they cannot disagree, and the copy is written once. Both
ids are always rendered, in all eight view states, so the name is never empty — in the four kinds
with no field, the `sr-only` heading alone keeps it non-empty.

Two details in that markup are contract rather than styling:

- **The name node holds the field and nothing else.** The header glyph sits beside it but outside
  this node, because it is chrome, and it is `aria-hidden` — its meaning is carried by its tooltip
  for a sighted reader and by the region's own heading for everyone else.
- **The `·` separators are text inside `context`, not a `::after` rule.** Generated content is not
  part of an accessible name, so as a rule the name would read _"Access control · Roles
  1Addresses"_. The file heading below takes the opposite decision for its `/` separator, and for
  the opposite reason: that one must stay out of the DOM so the copy-ownership scan reads the
  directory as the generator's data. Same punctuation question, two different answers, each driven
  by which mechanism is reading the string.

The name keeps describing the pinned field when a pointer activation moves focus out of the input —
that is the latch, and it is the interaction between operability and naming that is easiest to get
wrong. See [latch.md](./latch.md).

## Announcing a refresh

While a regeneration is in flight the region carries `aria-busy`. That is the whole announcement,
and its restraint is the point: this flag flips on **every keystroke**, so anything that added a
node, changed the height or replaced content would make the column churn under a screen reader
exactly while someone is typing. `aria-busy` adds nothing to the accessibility tree and is not
announced as a change; the visual half is an opacity fade delayed by 400ms, which a normal-speed
regeneration never reaches, and which is off entirely under `prefers-reduced-motion`.

The rows themselves stay put through a refresh rather than being replaced by a placeholder, so a
reader's position in the list survives it. See
[states.md](./states.md#freshness-a-flag-not-a-teardown).

## Rows

Each row is a real `<button type="button">` inside an `<li>`:

- Enter and Space activate for free, with no key handling of our own.
- The three row kinds — a line range, a whole file, a created file — have **equal standing**: same
  element, same affordance, same tab stop. They differ only in their label and in what activation
  sends.
- When activation is disabled, the button is `disabled`, not missing and not swapped for a `<span>`.
  The row count and the DOM shape stay stable, and a control that does nothing correctly leaves the
  tab order.
- Each row's accessible label names the detail and the file — _"Lines 201–219 in
  scripts/deploy.sh"_ — because the file is in a heading the row does not repeat visually.
- The rest-state arrow is `aria-hidden`. The row's whole message is its label, and a decorative
  glyph in the accessible name is noise. It exists because the affordance was previously
  hover-only, which is no affordance at all for a keyboard user or anyone who does not hover. It is
  an arrow rather than a chevron so it does not borrow the file tree's disclosure vocabulary.
- Rows have their own visible `:focus-visible` ring, so tabbing through the list shows where you
  are. The column root has one too, in the same accent.

## Selecting a list item by keyboard

Everything above is about the column. The form side has its own contract, because a list item can now
be _selected_ — marked as the thing the column is describing — separately from being in the
configuration. See [selection.md](./selection.md) for why that distinction exists.

**The marker is `aria-current="true"`, on exactly one element.** It sits on the same element that
carries the configuration anchor — the chip's wrapper, the issuer row's container — and is never
mirrored onto an inner button, because two carriers of one truth can disagree after any edit. The
value is the plain `"true"` and not `"page"` or `"location"`, whose navigational senses do not apply
here.

**It is `aria-current` and not `aria-selected`, and that is forced rather than chosen.**
`aria-selected` is only valid on a handful of roles, and adopting `option` — the plausible one — is
impossible for these components: browsers apply `role="presentation"` to **all** descendants of an
`option`, so a chip containing an `×` button, or a row containing a copy button and a group of pills,
cannot be one without destroying those controls' semantics.

**No new tab stop was added, anywhere.** The selection model needs no element to be focusable in
order to be selectable, so the focusable set of the wizard is exactly what it was:

- **A custom chip's body stays a real `<button>` even though it no longer has a click handler.** That
  is load-bearing rather than an oversight. It is still a tab stop, so a keyboard user can reach a
  custom topic and the focus writer selects it. Turning it into a `<span>` because "a button with no
  handler looks dead" would drop it out of the tab order and make custom topics keyboard-unreachable
  — silently, since nothing behavioural would notice.
- **An issuer row is reached through the controls already inside it** — the copy button, the `×`, a
  topic pill. Focus resolves outward to the nearest anchor, which is the row, so tabbing to any of
  them selects the row. The row itself carries no `role` and no `tabIndex`: it is not interactive, it
  is identified.
- **The `×` keeps its accessible name.** On a chip that is `Remove {label}`, which stays exactly what
  it was; nothing about selection changed what removal announces.

**Two `tabIndex` rules coexist here and they do not conflict.** The column root has exactly one tab
stop, whose value is `0` — see [the fix](#the-fix-one-static-tab-stop) above. The selection model's
own five modules and the three components that adopted it have **none at all**, pinned by a scan of
their sources. Different files, different guards, different purposes: one makes a region reachable,
the other keeps a list of items out of the tab order.

There is a trap underneath that second rule worth knowing if you ever relax it. **happy-dom focuses
an element with no `tabindex` where a real browser does not**, so a design that quietly depended on
focusing a `<div>` row would pass every test in the unit suite and fail live. The browser probe is
what would catch it, and only because the walk it runs is a real one.

## Grouping and the primary/secondary distinction

Grouping is carried by real headings — one per file, one per secondary group — so it is in the
accessibility tree whether or not the sticky heading is on screen.

The primary/secondary distinction is carried by the heading **word** (_Mentions_), never by colour
alone, with its explanation (_Lines that show this value without deciding it_) on the heading's
`title`. The heading's own text content is the marker word alone, and its glyph is `aria-hidden`, so
the distinction survives a render with no colour and no images. Tone is decoration layered on top of
the text. This was measured once rather than
argued: at heading level, the tone step against the surrounding muted foreground was a no-op, so
colour was never a usable axis here in the first place.

## Suppression

Below the width threshold with the file tree open, the column is removed with `display: none` —
which takes it out of layout, out of the tab order **and** out of the accessibility tree in one
declaration. There is no half-hidden state where a screen reader announces a region the user cannot
see.

Nothing announces the suppression, and nothing needs to. The only region the rule can remove is the
one this feature adds, and it leaves either because the user pressed the file-tree toggle or because
the user resized the window. The file-tree toggle's own label and pressed state stay literally true
at every width, which is a direct consequence of the column being the rail that yields. See
[layout-rule.md](./layout-rule.md#why-the-column-yields-and-not-the-tree).

## What is not handled

If focus is inside the column when a window resize crosses the threshold, focus drops to `<body>`
and the user must press Tab to get back into the document. This is named and accepted rather than
fixed; see [known-limits.md](./known-limits.md#focus-after-a-resize-across-the-threshold).

Resting-state glyphs are `aria-hidden` too: the state's meaning is already carried by its title and
description, and a decorative icon in the accessible tree would announce it twice.

## How this is verified

The unit suite holds the shape: one tab stop, on the root, in every view state; both name ids
resolving in all eight kinds; real buttons with no key handler; the distinction surviving with every
class attribute stripped. On the form side it drives the **real** identity step and asserts the
marker's literal value, that at most one element carries it after each of five clicks, that the chip
body is still a button and still a tab stop, and — by source scan — the absence of `tabIndex`, `role`
and `aria-selected` in all three adopted components. The walk that proves reachability starts outside the column, and deleting
the tab stop turns it red naming the failure in plain words — which was confirmed by actually
deleting it, not by reading the test.

The end-to-end keyboard route is the browser probe's, because happy-dom does not synthesise
Enter/Space activation on a button and will happily focus a `<section>` that carries no `tabindex`
at all. The probe tabs in from the drawer header, reaches the column root, confirms landing there
repopulates the rows, and confirms the next Tab lands on a row button. It also runs the suppressed
case: 160 Tab presses that do enter the three-region row and never reach the column — the second
half of that matters, because "Tab never got to the column" would otherwise be true for the wrong
reason if the walk had not entered the row at all.
