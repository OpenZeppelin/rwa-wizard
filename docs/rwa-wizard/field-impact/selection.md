# Selecting a List Item

> The column describes one configuration location at a time. Choosing which one is a separate idea
> from choosing what is in the configuration — and until this change, for a custom claim topic, it
> was not. A chip was "selected" precisely because it existed, so the only gesture that could
> deselect one was the gesture that deleted it.

## The modelling gap, which is the whole story

Here is the defect, and it is four lines of a call site rather than a mistake in a handler:

```tsx
{
  customTopics.map((topic) => (
    <TogglePill
      configAnchor={claimTopicAnchor(topic.id)}
      selected={true} // a literal — it can never be false
      onClick={() => onRemove(topic.id)} // body click destroys
      onRemove={() => onRemove(topic.id)} // × destroys
    />
  ));
}
```

`customTopics` is derived from the selected topics, so a custom chip is in the DOM **if and only if**
it is in the configuration. `selected={true}` is a literal because there is no other value it could
take. Eleven lines above, the predefined pills pass `selected={selectedIds.has(topic.id)}` — a real
predicate — and their `onClick` is a real membership toggle.

So `TogglePill.selected` meant two different things at two call sites: _is a member of the claim
topics array_ versus _is the thing the column is describing_. Separating those meanings is what this
page documents. Whether a topic _deploys_ is a third meaning, owned by `ClaimTopic.selected` on the
published config type; see [claim-topic selection](../../claim-topic-selection/README.md).

Once existence and selection are the same fact, deselecting and deleting are the same act, and the
only remaining click handler for the chip body is the destructive one. A user clicking a chip to
find out what it generates lost it.

**The fix is not a better click handler. It is a second idea.** There is now a distinct notion of
_which item the column is describing_ — the **inspected anchor** — held separately from membership.
`selected` went back to meaning membership alone, and for a custom chip it is now correct rather
than a symptom: for a custom topic, membership genuinely is presence.

Two things it is deliberately **not**:

- **Not a new field on the configuration.** Nothing was added to `RWAConfig`, no migration exists,
  and the generated output is byte-identical. This is a presentation-layer distinction, and putting
  it in the schema would have made a UI concern part of every generator's input.
- **Not a `Set`.** One item is inspected, or none. No requirement asks for two, and a set would be a
  generality with nothing behind it.

## The subject is an anchor, never a path

The inspected item is stored as a `ConfigAnchorKey` — `claimTopic|7`, `issuer|GABC…` — and resolved
to a `ConfigPath` on every render.

That choice is what makes the edge case in the original report a non-event. Removing the first of
three trusted issuers shifts the indices of the other two; a stored `ConfigPath` would silently
begin naming a **different issuer**, with nothing thrown and a plausible-looking list of files
underneath it. An anchor carries only draft-independent identity, so it either still names the same
item or names nothing at all.

It is also a **string**, which is not incidental. The store's "already the subject" bail-out is a
value comparison; if the subject ever became an object or a per-resolution allocation, that
comparison would miss every time and every focus move inside an already-inspected cluster would
notify the column. That is a re-render storm on the drawer's hot path, and it would look like a
performance problem in the column rather than a type change somewhere else.

**Removal does not clear the subject, and nothing listens for it.** When an item is removed, the
subject stops naming it at _read_ time: the resolver checks that the item still exists before
resolving, and the column empties honestly. An event-driven clear was considered and is unwritable —
React fires **no event at all** when it unmounts a focused element, so the handler would look present
in review and never run.

## One document listener, not a handler per component

Selection is written by two listeners on `document`, both bubble-phase, and by the two add handlers.
There is **no `onClick` on any list item for this purpose**. A click resolves outward from its target
to the nearest ancestor carrying an anchor — exactly the walk focus resolution already uses.

What that buys is out of proportion to its size:

| A click lands on                | Nearest anchor                 | The subject becomes                                         |
| ------------------------------- | ------------------------------ | ----------------------------------------------------------- |
| A custom chip's body            | the wrapper's `claimTopic\|id` | that topic — and the chip survives                          |
| A custom chip's `×`             | the same wrapper               | that topic, then nothing, once the item is gone             |
| An issuer row's background      | the row's `issuer\|address`    | that issuer                                                 |
| The row's copy control          | the row, by the outward walk   | that issuer                                                 |
| A per-issuer topic pill         | the pill group's own anchor    | that issuer's topic list — the pill keeps its own behaviour |
| The Add button                  | a draft anchor                 | unchanged; the add handler writes the created item instead  |
| The drawer, file tree or column | none                           | unchanged                                                   |

Three consequences worth naming, because each is a thing that did **not** have to be written:

- **The issuer row needs no `onClick` on a `<div>`.** It carries an anchor and nothing else. A click
  anywhere in its background selects it, including on the padding between its controls.
- **The nesting resolves itself.** A per-issuer topic pill sits inside an anchored issuer row, and
  "nearest anchor" is already the right rule for it — the pill's own group wins. No guard was written
  in the row to stop the row from swallowing its children's clicks, because none is needed.
- **It works for the nine components this change did not adopt.** The same listener covers compliance
  module cards, the four selectable cards, the predefined pills and the operator-role rows. Their
  behaviour is unchanged in Chrome and Firefox, where clicking them already focused them — and newly
  correct in Safari, which never focused them at all. Excluding them would have cost a special case
  and bought a worse product.

### And therefore no `tabIndex`, anywhere

The five modules of the selection model and the three components that adopted it contain **no
`tabIndex`**, and a source scan pins its absence rather than its value.

This is a property the design bought rather than a rule imposed on it. Nothing here needs an element
to be focusable in order to be selectable: the click writer does not need focus, and the add handlers
write directly. A keyboard user reaches an issuer row by tabbing to a control inside it — the copy
button, the `×`, a topic pill — and the outward walk selects the row. No new tab stop, no roving
index, and no long list of issuer rows to traverse before reaching the one you want.

The absence is pinned rather than the value for a specific reason. `tabIndex={-1}` on the issuer row
would insert nothing into the tab order and would be harmless — and it invites the next hand to
write `tabIndex={0}`, which puts every row in the tab order and makes traversing a list of them
strictly worse. There is also a harness trap underneath it: **happy-dom focuses an element with no
`tabindex` where a real browser does not**, so a design that depended on focusing the row would have
passed every test in the suite and failed live.

The column's own single tab stop is a different thing entirely, and it stays. See
[accessibility.md](./accessibility.md#the-fix-one-static-tab-stop).

## Why focus alone was not the model

Focus is the obvious answer — it is already resolved, already carries a location, already changes on
click, and needs no new state. A reader will propose it, so here is why it was scored and rejected
rather than overlooked. Three reasons, independent, all measured.

**1. Safari does not focus a `<button>` on click — and pulls focus off whatever was focused before.**
This is WebKit's settled, deliberate behaviour, matching the platform. Under a focus-only model a
Safari user clicking a custom chip does not select it; they empty the column, because focus left the
last thing that resolved and arrived nowhere. The fix would have shipped the bug. Setting `tabindex`
is only a partial mitigation: from Safari 17.2.1 it stops focus being _pulled away_, but it still
does not focus the clicked element.

**2. After an add, focus points one slot past what was created.** The two draft anchors — the topic
form and the issuer form — resolve through the collection's `length` and its next index, which is
correct: they name the slot the **next** item will occupy. So the instant an add lands, "whatever the
Add button resolves to" names the item _after_ the one just created. Leaving focus on the Add button
describes an empty slot. Moving focus to the new row is a programmatic imperative act — which is a
selection mechanism using the browser's focus slot as its storage, and focus is a strictly worse
store: single-slot, globally shared, owned by the browser, and clobbered by anything else focusable
in the app.

**3. Focus can only answer one question, and there are two.** Where focus belongs after an add, and
what the column should describe, are different questions with different right answers. The
established guidance for add-to-list flows — Primer's and Cloudscape's alike — is that focus returns
to the text input, because the user is likely to add several in succession. That is exactly the
trusted-issuer flow. Under a focus-only model those two obligations are **one variable**, and one of
them has to lose. With a separate subject they are two variables and both win: focus returns to the
input so repeat entry works, and the column keeps describing the item that was just created.

That third one is the user-visible payoff, and it is the sharpest argument of the three.

One thing focus keeps: it is still the **default writer**. Every control that resolved before still
selects itself on focus, with no change to its markup. That is the sanctioned pattern rather than a
compromise — selection following focus is right when the consequence is cheap, and inspecting a
configuration path is as cheap as it gets.

## The two Add handlers, and why the refusal is doing the work

Both add flows write the subject directly, because the code that performs the add is the only code
that knows what was created:

```tsx
onAddCustom({ id: parsedId, name, isCustom: true });
inspect(claimTopicAnchor(parsedId));
reset({ name: '', id: '' });
document.getElementById('custom-topic-name')?.focus();
```

The same interaction also produces a competing write. The click that triggered the add reaches the
document listener, which resolves the Add button to **its** anchor — a draft anchor, naming the slot
one past what was just created. If that write won, the column would describe the next empty slot: the
reported defect, shipped inside the change that fixes it.

It does not win, and **the ordering of the two writes is not why.**

| Add flow       | How it runs                                | Relative to the document listener |
| -------------- | ------------------------------------------ | --------------------------------- |
| Custom topic   | a plain synchronous `onClick`              | **before** the listener           |
| Trusted issuer | `onClick={handleSubmit(handleAdd)}`, async | **after** the listener            |

The two orderings are opposite, and the add write survives both — because `inspect` **refuses a draft
anchor outright**. A draft anchor names no item, so nothing can truthfully be said about it, and the
refusal is checked on the way in rather than raced for.

**This is the paragraph to read before fixing an ordering bug here.** The tempting repair — reorder
the `inspect` call, or move it out of the submit handler, or make the listener run later — removes
the protection silently, and leaves a bug that reproduces on exactly one of the two forms. The
refusal is what makes both orderings correct; the ordering is what makes the refusal look
unnecessary.

The focus return on the last line is safe for the same reason: it fires a `focusin` that resolves to
the same draft anchor, and that write is refused too. So repeat entry and the column's answer are
genuinely independent — the focus return could be deleted tomorrow and the column would still be
right.

## What adopted the pattern, and what did not

Two components adopted it, and nine were swept and excluded with a reason each:

| Component                                    | Decision                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Custom claim-topic chips                     | **Adopted** — body was destructive; now inspect-only. Selection is the checkmark (`onToggleSelection`); `×` deletes. |
| Trusted-issuer rows                          | **Adopted** — body click did nothing; now selects.                                                              |
| Predefined claim-topic pills                 | **Adopted (SF-17)** — body is inspect-only; deploy-selection is the dedicated checkmark via `onToggleSelection`. |
| Per-issuer topic pills                       | Excluded — pure-toggle `onClick` membership; they keep their own behaviour.                                     |
| The four selectable cards                    | Excluded — same.                                                                                                |
| Compliance module cards                      | Excluded — same.                                                                                                |
| Operator-role and module-config address rows | Excluded — kit-owned markup; per-address selection needs a kit release. The role-level anchor already resolves. |
| `Badge`'s `onRemove`                         | Excluded — the prop has **zero call sites**. Flagged so a future caller does not reintroduce the same defect.   |

"Excluded" here means only that the component did not need the three-affordance chip split. Claim-topic
pills and custom chips share `TogglePill`'s `onToggleSelection` mode: body click never toggles config;
inspection is the document listener's job. All of them are still selected by the document listener, and
all of them gained correct Safari behaviour for free.

## The marker

An inspected item carries `aria-current="true"` and one ring utility, composed through `cn`. That is
the entire visual and semantic surface: no new element, no `role`, no icon, no `data-selected`.

**`aria-current` and not `aria-selected`, and this is a constraint rather than a preference.**
`aria-selected` is only valid on a handful of roles — `option`, `tab`, `row`, `gridcell`, `treeitem`
and two header roles. Adopting `option` is impossible for these components: browsers apply
`role="presentation"` to **all** descendants of an `option`, so a chip containing an `×` button, or a
row containing a copy button and a group of pills, cannot be one without destroying those controls'
semantics. `aria-current` carries no role restriction and means precisely "this is the currently
active one".

Exactly one element carries it — the same element that carries the anchor. Mirroring it onto the
inner button would create two carriers of one truth, and two carriers can disagree after any edit.

**The ring is offset on the chip and not on the row**, which looks inconsistent and is not:

| Item        | Cue                                                        |
| ----------- | ---------------------------------------------------------- |
| Issuer row  | `ring-1 ring-primary`                                      |
| Custom chip | `ring-1 ring-primary ring-offset-1 ring-offset-background` |

The row is otherwise `border-border`, so a one-pixel primary ring is the only primary-coloured thing
in it and the marked row is unambiguous down a list of four. A custom chip is **always** selected,
which already paints `border-primary bg-primary/10 text-primary` — so an unoffset ring lands
immediately outside that border in the same hue and reads as a doubled edge rather than a distinct
state, on exactly the component where "in the configuration" and "what the column is describing" most
need telling apart. The offset lifts the marker clear of the border.

`ring-offset-background` rather than a bare `ring-offset-1` is the half of that easiest to omit: the
offset is painted in `--tw-ring-offset-color`, which **defaults to white**, so without the token the
gap is a white notch in dark mode. The app's own focus styles already pair the two, so this is the
established spelling rather than a new one.

There is one open question about the ring, and it is not resolved here — `ring-*` is otherwise this
app's _focus_ vocabulary, so a persistent ring may read as "focused". See
[known-limits.md](./known-limits.md#the-selection-ring-borrows-the-focus-vocabulary).

## What holds this together

Everything above has a silent failure behind it, so each is pinned rather than reviewed:

- **The subject is a string, checked at compile time.** A type-level assertion fails the build if
  `ConfigAnchorKey` ever stops extending `string`, which is what keeps the store's bail-out a value
  comparison.
- **Both refusal cases notify nobody.** An implementation that writes the same value and notifies
  anyway passes a snapshot-equality assertion and still re-renders the column on every focus move
  inside one anchored cluster.
- **Two predicates are exhaustive `switch`es with `never` tails**, so a fourteenth anchor kind that
  also names a pending slot is a compile error in both places rather than a silent `true`.
- **Existence is expressed in the resolver's own index helpers**, not in a parallel test, so
  existence and resolution cannot drift apart.
- **A click is read from `event.target` with a plain `closest`, never `composedPath()`.** A click
  inside the code preview's shadow root retargets to a host that carries no anchor, so browsing
  generated files cannot change what the column claims about a form field.
- **The provider mounts above both subtrees, asserted structurally.** The context defaults to `null`
  and every hook degrades to inert on it, which is what lets the components render in test harnesses
  and in the markup guard with no provider — and it means forgetting the provider would ship the
  whole feature inert with a fully green suite.
- **Exactly two document listeners, added once and both released**, with the empty dependency array
  pinned. Re-subscribing on every change would accumulate listeners across a session and race their
  writes.
- **A scope change drops the subject.** The scope is the reset key, the active draft and the current
  step; without the step, a user could inspect a claim topic, navigate to Compliance, and leave the
  column describing an item that is nowhere on screen.
- **Nothing is persisted, fetched, logged or measured.** A fresh mount starts at "nothing inspected".

## Related

- [latch.md](./latch.md) — what keeps the answer when the user reaches into the column, and the one
  case where the subject alone is not enough.
- [accessibility.md](./accessibility.md#selecting-a-list-item-by-keyboard) — the keyboard route and
  what `aria-current` exposes.
- [api-reference.md](./api-reference.md#featureswizardinspected-anchor) — every export, with
  signatures.
- [integration-guide.md](./integration-guide.md#pattern-4-make-a-list-item-selectable) — adopting the
  pattern on a new component.
