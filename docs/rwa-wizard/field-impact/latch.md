# The Latch

> The column describes the field the user is working in. Clicking one of its rows moves focus into
> the column — so without a latch, reaching for the answer erases it. The latch is what keeps the
> answer across that reach. It used to hold a resolved path stamped against the draft it came from;
> it now holds a flag, the last answer the column actually rendered, and the draft that was in force
> when the reach began.

## The problem

The column's field is a function of what has focus. That is the right binding for the ordinary case,
and it is fatal for the one interaction the column exists to support: activating a row. The pointer
press moves focus out of the input and into a button in the column, the resolved path becomes
`null`, and the rows the user was reaching for vanish in the same frame as the click.

## What most of the latch became

Most of what the latch used to do is now done by [the inspected anchor](./selection.md), and it is
worth being precise about which part, because the remainder is small and easy to mistake for the
whole.

The old latch held a **resolved `ConfigPath`** — and a path carries array indices, which the draft
can shift underneath it. That is the entire reason it needed a stamp: a held path could outlive the
configuration that named it, and start naming a different item. The subject holds an **anchor**
instead, which carries only draft-independent identity and is re-resolved against the live draft on
every render. There is no stored index left to go stale, so there is nothing to stamp.

Gone with it: `HeldField`, the generate-key stamp, and the render-phase `setHeld` that kept it
current. The "Too many re-renders" hazard that the render-phase write's convergence argument guarded
against is now unreachable rather than merely unlikely, because there is no render-phase state write
in this hook at all.

**Keeping the old held path alongside the subject would have been actively wrong**, not merely
redundant. After an add, the held path is the Add button's path — one slot _past_ the item just
created — while the subject is the created item. Any priority order that lets the held path win
reintroduces the reported defect inside the change that fixes it, and there is no ordering of two
overlapping caches that beats having one.

## What the latch still is

One piece of state, and one piece rather than two deliberately:

```ts
interface ColumnLatch {
  readonly hasFocus: boolean;
  readonly answer: ConfigPath | null;
  readonly armedConfig: RWAConfig | null;
}
```

- **`hasFocus`** is the gate: is the user physically inside the column right now?
- **`answer`** is the last path the column actually rendered.
- **`armedConfig`** is the draft in force when the gate opened, compared by reference and never read
  into.

They live in one slot because a separate slot for the answer could disagree with the flag about
whether the latch is armed. It also keeps the hook at exactly one `useState`, which a source scan
pins.

The gate is set by the same three handlers as before, spread on the column's root element:

- **`onPointerDownCapture`** opens it. Capture phase, so it runs **before** any focus change. Without
  it, a browser that does not focus a `<button>` on mousedown — or an unlucky interleaving of the
  native `focusin` against React's synthetic `onFocus` — renders one frame of "No field selected":
  the rows vanish and reappear under the cursor at the instant the user is reaching for one, and the
  click can land on a different row than they aimed at.
- **`onFocus`** opens it. That is the keyboard arrival, and it is also what makes the column's tab
  stop work at all — see [accessibility.md](./accessibility.md).
- **`onBlur`** closes it when `relatedTarget` is not inside `currentTarget`.

The blur test is a plain `Node.contains`, deliberately not the composed walk the drawer keeps for the
file tree. The column renders no shadow root, and a `relatedTarget` inside the file tree's shadow
root is retargeted to its host, which is outside the column — so the latch releases, which is the
right answer. A composed walk would either flicker or freeze the column on a stale field while the
user browses a different file.

## Why the subject alone was not enough

The subject covers the ordinary reach: click a chip, reach into the column, and the subject is still
that chip regardless of where focus went. The gap is a location that **resolves but does not exist
yet**.

There are several of them, and they are ordinary: an operator role with no addresses configured, a
pending trusted issuer, a deselected predefined claim topic, a config field of an unselected module.
For all of these, focusing the control renders rows correctly — the live focus resolver returns the
path. But the subject is `null`, because the subject is existence-checked and the item does not exist
yet.

So the reach empties both sources at once:

| Step                          | Live path                          | Subject                | Result            |
| ----------------------------- | ---------------------------------- | ---------------------- | ----------------- |
| Focus a pending operator role | `accessControl.roles[0].addresses` | `null` — no such item  | rows, correctly   |
| Reach into the column         | `null` — focus moved               | `null` — still no item | **`not-a-field`** |

`not-a-field` reads _"Not part of the configuration, so no generated code is attributed to it"_ —
about a control that plainly writes `accessControl.roles`. That is the exact class of statement this
feature exists to never make, and under the old held latch it did not happen.

**So the latch keeps a floor under that case**, and only that case: when both live sources have gone
quiet _because of the user's own reach_, the column keeps saying what it was saying. It restores
exactly what the old latch did in that situation, so there is no new behaviour to defend.

Two alternatives were refused, and the second is worth knowing about because it is the better answer:

- **Let the subject yield the pending path.** Refused. A pending slot names a _different, later_
  item, and it renders as a confident, populated list rather than an obvious blank — the
  confident-wrong-item failure this whole feature was built to eliminate.
- **An eighth view kind, for "resolves but does not exist yet".** Genuinely the honest answer, and not
  built here. It has now been wanted twice. See
  [known-limits.md](./known-limits.md#the-pending-location-has-no-state-of-its-own) for the standing
  rule about when it stops being a refinement.

## The answer must be maintained, not captured on arrival

The first attempt at this captured the answer **when the latch armed**, which is the obvious design
and is wrong. It passes every browser-free test that reaches the column directly from the control it
describes, and it fails a real Tab walk.

The mechanism is worth following, because nothing in it misbehaves. Tabbing from the form to the
column passes through the drawer chrome — the tree toggle, the maximize button, the close button, the
code pane. Every one of those is a live control that writes no configuration, so the column correctly
empties on the way through. By the time focus arrives at the column root there is nothing left to
capture.

So the answer is written **continuously**, from an effect, whenever the column renders a real one:

```ts
// What the column would say with nothing remembered — the honest answer, and the
// only thing worth remembering.
const unheldPath = resolveImpactSubject({ ...subjectInput, heldAnswer: null });

useEffect(() => {
  if (unheldPath === null) return;
  setLatch(rememberAnswer(unheldPath));
}, [unheldPath]);
```

Three properties of that block are load-bearing:

- **It never overwrites a remembered answer with nothing.** Surviving the unresolvable controls the
  user tabs through on the way in is the entire point.
- **It runs after commit, never during render.** That is what keeps the "Too many re-renders" hazard
  structurally absent, and it is why the source scan pins _no setter during render_ rather than a
  count of setter sites — a bare count of four would pass with one of them in the render body.
- **The honest answer is computed through the same function with `heldAnswer: null`.** One rule,
  asked twice, rather than two rules that can drift apart.

This is the failure that a real browser caught and no browser-free test could, because it is a
_missing_ case rather than a wrong one. The probe now demonstrably detects it: with the clause absent
the keyboard-reachability check fails, with it present the same check passes under the same
conditions.

## The draft is captured at arm time, not stored beside the answer

`armedConfig` is captured once, when the gate opens, and the held answer is dropped if the draft has
been replaced since:

```ts
const heldAnswer = latch.hasFocus && latch.armedConfig === config ? latch.answer : null;
```

Storing the draft alongside **each** remembered answer is the tidier-looking design — keep the
configuration next to the answer it belongs to — and it costs a render per keystroke. Every edit
replaces the draft object, so the effect would write on every keystroke even when the focused control
had not moved. The column's memo test caught it as `expected 2 to be 1`. A source assertion pins the
arm-time capture, because the change that undoes it reads as an improvement.

The reference comparison replaces the old stamp, and it is both cheaper and stronger: it does not
depend on a hash covering the right fields. What it guards is real rather than theoretical — four
pre-existing call sites in two hooks mutate the draft from inside `useEffect` bodies rather than from
a control's handler, so a draft genuinely can be replaced mid-reach. See
[known-limits.md](./known-limits.md#one-property-that-is-pinned-rather-than-held).

## The four invalidation inputs

The latch is a cache, and a cache is only as good as its enumerated invalidation. There are exactly
four inputs, one test each:

1. A pointer press on the column — opens the gate and captures the draft.
2. A focus arrival on the column — the same, by the keyboard route.
3. A blur whose `relatedTarget` is outside the column — closes the gate.
4. The draft being replaced while the gate is open — drops the held answer.

Deliberately **not** inputs, one negative test each: elapsed time; moving between rows _inside_ the
column, since re-arming would overwrite the answer with whatever the column is producing right now; a
blur whose `relatedTarget` is inside the column; and the same draft object re-rendered.

Arming is idempotent — the updater returns the previous state when the gate is already open — so a
focus move between rows costs no render. Releasing keeps the remembered answer rather than clearing
it; it is inert while the gate is closed, and clearing it would be work for no observable difference.

## How this differs from the latch it replaced

Three differences, and each is why the old one needed machinery this one does not:

- **When it is consulted.** The old held path was used whenever the live path was `null`, so it
  competed with the subject and, after an add, won with the Add button's pending path. `answer` is
  consulted only while the user is physically inside the column, and only after the subject _and_
  live focus have both come up empty.
- **How it is invalidated.** The old one needed a generate-key stamp because it outlived arbitrary
  draft mutations. This one is dropped on any draft replacement by reference.
- **Where it is written.** The old one was written during render. This one is written from the three
  handlers and one post-commit effect.

## Where the latch does not live

It is not in the focus-resolution hook upstream. That hook answers "what is focused now"; this one
decides how long to keep an answer. The transition the latch is about is "focus moved into **my**
subtree", and only the column can identify its own subtree — putting it upstream would mean the
resolver guessing at this component's DOM.
