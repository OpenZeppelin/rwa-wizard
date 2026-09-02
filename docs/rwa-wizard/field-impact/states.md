# The Eight States

> Everything the column can be is one closed union of eight shapes, produced by a pure function of
> three inputs. Seven of them are resting states with their own copy; the eighth is the answer. There
> is no ninth, and adding one fails compilation at the render site rather than rendering a blank
> rail.

## The union

```ts
type FieldImpactView =
  | { readonly kind: 'no-preview' }
  | { readonly kind: 'unsupported' }
  | { readonly kind: 'no-focus' }
  | { readonly kind: 'not-a-field' }
  | { readonly kind: 'pending'; readonly path: ConfigPath }
  | { readonly kind: 'uncreated'; readonly path: ConfigPath }
  | { readonly kind: 'empty'; readonly path: ConfigPath }
  | {
      readonly kind: 'groups';
      readonly path: ConfigPath;
      readonly stale: boolean;
      readonly groups: readonly ImpactGroupView[];
    };
```

`stale` is **required**, not optional, so a construction site that forgets it fails `tsc` rather
than quietly claiming the rows are current. It is a flag on `groups` rather than a ninth kind
because a ninth kind would have to answer everything `groups` answers — same path, same
partitioned rows, same activation contract — and would be `groups` under another name, duplicated at
every render and construction site.

The component switches over `kind` with a `never` arm. A blank 260px rail looks exactly like a
layout bug, and it is the failure a fall-through would produce — so the type system is what prevents
it, not a default case that renders something plausible.

Every resting state carries a title, a description and a glyph. The empty-state component requires
both strings, and the glyph map is a `Record` over the same seven kinds, so an eighth resting state
fails `tsc` in two places rather than arriving with copy and no icon:

| Kind          | Glyph                                             |
| ------------- | ------------------------------------------------- |
| `no-preview`  | `FileCode2`                                       |
| `unsupported` | `HelpCircle`                                      |
| `no-focus`    | `MousePointerClick`                               |
| `not-a-field` | `CircleDashed`                                    |
| `pending`     | `Loader2`, spinning, stilled under reduced motion |
| `uncreated`   | `CircleDashed`                                    |
| `empty`       | `FileMinus2`                                      |

`pending` reuses the drawer's own spinner, which is what the drawer already shows for the same
fact.

| Kind          | Title                             | Description                                                              |
| ------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `no-preview`  | No code preview                   | Generated code is not available for this target.                         |
| `unsupported` | Impact not reported               | This generator does not report field impact.                             |
| `no-focus`    | No field selected                 | Select a configuration field to see what it generates.                   |
| `not-a-field` | Not a configuration field         | Not part of the configuration, so no generated code is attributed to it. |
| `pending`     | Regenerating                      | The generated code is being rebuilt.                                     |
| `uncreated`   | Not added yet                     | This configuration slot does not exist in your draft yet.                |
| `empty`       | Nothing generated from this field | No generated file depends on this field's value.                         |

`pending` is narrower than its copy suggests: it is reached only when a regeneration is in flight
**and** there is nothing to keep on screen. A keystroke in a field that has rows does not produce
it. See [Freshness](#freshness-a-flag-not-a-teardown).

`uncreated` is the honest answer for a path that resolves in the anchor layer but names a collection
index the live draft does not hold yet (a pending operator-role slot, a trusted-issuer Add draft,
and similar). Prefix matching against parent-collection provenance would falsely populate rows;
this kind refuses that. It is decided **before** freshness and lookup, so a mid-rebuild cannot
mislabel an absent slot as `empty` or `pending`.

All eight states render the header — one line, outside the scroll region — so the column always
answers _which field am I describing_, including at the drawer's smallest height where the whole row
is 36px tall. The strings live in `@openzeppelin/rwa-wizard-copy`; nothing above is written in a
component.

### The header

The header is a glyph and a field name sharing one line:

```
{ }   Access control · Roles 1 · Addresses
```

The glyph (`Braces`) carries the region's description as its tooltip, and it is what says the rail is
about generated code without spending two words of a 260px line saying it. It renders only alongside
a field, and it sits **outside** the accessible-name node, because it is chrome.

The field name is a **humanised** spelling of the config path rather than the raw one: `token.name`
reads as `Token · Name`, and `accessControl.roles[0].addresses` as `Access control · Roles 1 ·
Addresses`, with the raw path kept on `title`. Indices are shown 1-based, because the column is the
only place in the wizard where an index surfaces at all and _Roles 1_ names the first role to
someone who has never met a zero-based one.

The context truncates and the field never does, mirroring the file heading below it and for the same
reason: a three-segment path overruns the rail, and the segment a single truncating string loses is
the one the user just typed into. Truncation never touches `textContent`, so the accessible name is
the whole field however narrow the rail gets.

That spelling is produced by `humaniseConfigPath`, and it lives in the app rather than in the copy
package because it is **a formatting of data, not authored copy** — the same category as the file
path split beside it. The words come from the config schema the user is editing, and there is no
sentence to localise. What it replaced was data too; it was just data rendered as a code identifier
at the one place a first-time reader looks for a subject.

## The order is load-bearing in two places

`toFieldImpactView` is a table of ordered early returns. Two of the placements are correctness, not
style, and both are commented at the call site so the next reader does not tidy them:

| #   | Condition                                | Result        |
| --- | ---------------------------------------- | ------------- |
| 1   | no provenance, or no tree on screen      | `no-preview`  |
| 2   | the generator does not record provenance | `unsupported` |
| 3   | no path, nothing focused                 | `no-focus`    |
| 4   | no path, something focused               | `not-a-field` |
| 5   | the tree on screen is not the live draft | `pending`     |
| 6   | the field resolves to no files           | `empty`       |
| 7   | otherwise                                | `groups`      |

**`unsupported` comes before the field states.** If the generator does not record provenance,
"Select a configuration field" is a lie: focusing one will not help, and the user keeps trying.

**`pending` comes after them.** Placed ahead, every keystroke anywhere in the wizard would flip an
_unfocused_ column between `no-focus` and `pending` — a rail that flickers while the user is typing
somewhere else entirely and has not asked it anything. With no field, there is nothing to be stale
about. That single placement is the whole anti-flicker guarantee.

Rows 6 and 7 share one lookup into the provenance seam, bound once. The naturally written form —
`lookup(path).groups.length === 0 ? … : lookup(path)` — doubles the per-render cost of the only
linear operation on a hook that re-renders on every focus change in the app.

## The input space grew from three states to four

`toFieldImpactView` still takes the same three inputs, and its logic is unchanged. What changed is
which combinations of them are **reachable**.

When `path` came only from the focus resolver, both `path` and `hasFocusedElement` derived from the
same focus gate, so `path !== null` implied `hasFocusedElement`. The combination
`{ path: non-null, hasFocusedElement: false }` was unreachable by contract.

It is now the **ordinary case for an item the user has just created.** The Add button disables itself
the moment the form resets, so on some browsers focus ends up on nothing at all — and the column's
subject still names the created item. The path now comes from
[the subject rule](./selection.md#the-subject-is-an-anchor-never-a-path), which may outlive live
focus; `hasFocusedElement` still comes from the focus resolver unchanged. The two are independent, and
both statements stay true.

**No logic changed for it, and that is the point worth recording.** The function was already total
over that state and already treats the path as the stronger evidence, which is exactly the wanted
behaviour — so a previously unreachable branch became reachable and correct on the same day.
Requiring `hasFocusedElement` before honouring a path would break precisely the case this now serves.

`hasFocusedElement` is never derived from the subject and is passed through unchanged. A subject with
no live focus is honest about both facts; inventing focus to make the view look right would also make
`not-a-field` unreachable.

### `uncreated` — a resolvable path the draft does not hold yet

There used to be one thing the resting states could not say: _this is a real configuration location,
and nothing has been generated for it yet_ — a pending operator role, a pending trusted issuer, a
deselected topic that still rendered an anchor. Prefix matching against parent-collection provenance
would falsely populate rows; `empty` would be false about the slot; `pending` means regeneration.

`uncreated` is that answer. `toFieldImpactView` reaches it when `resolveConfigPath(config, path)`
reports the path is not found in the live draft, **after** the null-path forks and **before**
staleness / lookup. The latch can keep naming the slot while the user reaches into the column; the
column still refuses to invent rows. See
[known-limits.md](./known-limits.md#the-pending-location-has-no-state-of-its-own) for the earlier
gap this closed.

## The two empty states, and why their copy may not merge

`not-a-field` and `empty` both mean "there is nothing to list". They read as duplicates, they are
adjacent in the copy file, and merging them would remove a state and a string. **Do not.**

The wizard has one control with a shape that makes the merged wording false.
`include-identity-support` on the Review step is a **generation option**: it is threaded to the
file-tree and archive
generators and is part of the preview's generate key, so ticking it demonstrably changes the
generated tree. It also, correctly, resolves to no configuration path — because configuration paths
span `RWAConfig`, and generation options are not in `RWAConfig`. It is the only control in the
wizard with that shape.

So the two strings divide the claim, and the division is the point:

- **`not-a-field` speaks about the control and about attribution, and never about effect.** "This
  control is not part of the configuration, so the generator does not attribute generated code to
  it." That is true for the Next button, which has no effect on the generated tree, _and_ for
  identity support, which has a large effect that is simply not attributed.
- **`empty` is the only string permitted to make a claim about the generated code.** "No generated
  file depends on this field's value." It is shown only for a field that genuinely resolved to a
  configuration path and came back with no files.

A single merged string — the natural one is "this field doesn't affect any generated code" — would
be **plainly false** for identity support: the user ticks a box, watches four files appear in the
tree beside it, and reads a sentence telling them it affects nothing.

The test that holds this drives the real Review-step control through the real focus resolver rather
than asserting that a hand-written `null` produces `not-a-field`, which is the tautology. Its copy
assertion checks for effect claims and separately requires the word `attribut`, so a reword in
either direction fails rather than passing quietly.

## Freshness: a flag, not a teardown

The column must never show rows computed against a tree that is no longer on screen. Two values
published by the preview seam decide whether a refresh is in flight:

- `state.identity` — the generate key of the tree **on screen**.
- `liveIdentity` — the generate key of the **undebounced** draft.

They diverge the instant any generate input changes, and staleness is a plain `!==` between them.
That includes the case worth naming: ticking a compliance module somewhere else in the wizard while
the focused field, its element and its value are all untouched. The module catalog is carried
through the hashed preview config, so the live key moves.

**The decision still happens at render**, from two strings that already exist. No effect, no
subscription, no timer, nothing to tear down — so the answer is right in the same commit in which
the identity changes, not one frame later.

What changed is **what that decision renders**. Staleness is now a flag on the answer:

| Situation                          | Result                                |
| ---------------------------------- | ------------------------------------- |
| Refresh in flight, rows to keep    | `groups` with `stale: true`           |
| Refresh in flight, nothing to keep | `pending`                             |
| Settled                            | `groups` with `stale: false`, `empty` |

### Why the rows stay

Tearing the rows down and showing a placeholder was the first design, and it was wrong in a way
only the running app showed: regeneration is debounced per character, so the column blinked to a
placeholder **once per keystroke** in the one field the user was looking at. That is the flicker the
table's ordering exists to prevent, produced by the freshness gate instead of by the ordering.

Keeping them is safe for a structural reason rather than a judgement call. `state.identity` is the
identity of the tree **on screen**, and the preview seam commits the tree, its provenance and that
identity in a single render. So while `stale` is true, the rows and the code pane are the same
generation, and the line a row names is a line the user can actually see. The thing that has moved
on is the draft, which has not been rendered anywhere yet. **Rows computed against a tree that is no
longer on screen remain impossible**, and impossible for the same structural reason as before.

### Activating a row while it is refreshing

Keeping the rows clickable through a refresh raises a question the earlier design never had to
answer: a range sent during the window is stamped with the on-screen tree's key and discarded the
moment the new tree lands, so a naive click looks live and does nothing.

**The click is therefore split.**

- **The file is revealed immediately.** A path survives a regeneration untouched, so the pane lands
  on the right file with no delay.
- **The range is held and re-issued once**, on the first render where the tree is no longer stale.

The re-issue is **a re-resolution, not a replay**. The held request names what the user pointed at —
config path, file path, and the row's index in the unpartitioned list — and never the line range
itself. When a fresh tree arrives, the range is read off the row that tree renders. A row named a
_site_ ("where does this field land in `deploy.sh`"), and that question has an answer in the new
tree; the old line numbers are not that answer.

It is dropped with no reveal, rather than guessing, when:

- the focused field moved on — the row index names a position in _that_ field's row list, so
  applying it to another field's would reveal an unrelated site, silently and plausibly;
- the file is no longer in the tree;
- the site is no longer a range, so there is nothing to mark and nothing is synthesised in its
  place.

It survives an intermediate stale tree, so someone who keeps typing gets **one** reveal when they
stop rather than a queue of them. It is not a retry loop, not a timer and not a "last known"
fallback: one request, held across a tree change, re-resolved from rows already on screen — no extra
seam call, so the one-lookup-per-evaluation bound is untouched.

So a kept row does land on the line the user can see. State it precisely: **true once the tree
settles, by deferred re-resolution — not instantaneously.**

### How the refresh is signalled

Two channels, both deliberately non-displacing — neither can change the column's height or replace
its content, which matters because this flag flips on every keystroke:

- `aria-busy` on the region. Adds no node and is not announced as a change.
- `data-impact-stale`, which drives a CSS opacity fade on the scroller with a **400ms delay**.

The delay is what makes the signal cost nothing in the ordinary case: a regeneration that finishes
at normal speed never reaches the fade at all. Measured in a real browser over a 22-character edit,
the scroller's computed opacity never left `1`. Under `prefers-reduced-motion` the animation is off
entirely.

It is a CSS `animation-delay` and **not** a JS timer, on purpose. The feature forbids `setTimeout`,
`setInterval` and `requestAnimationFrame` under `impact/` so that no fourth timing input has to be
enumerated in the hook; a declarative delay adds no state to the component and nothing for a test to
hold.

`pending` keeps the field name and drops only the rows, because in that state there are none to
keep — and `empty` may not be shown about a tree that is mid-rebuild, since it is the one string
permitted to claim something about the generated code.

## The `groups` shape

```ts
interface ImpactGroupView {
  readonly path: string;
  readonly directory: string;
  readonly leaf: string;
  readonly primary: readonly IndexedRow[];
  readonly secondary: readonly IndexedRow[];
}
```

One group per file, in the order the provenance seam reported, one-to-one — no filter on the group
array, no dedupe, no cap, no truncation. File hiding belongs entirely to the seam and is asked once
upstream; a second hiding rule here would diverge from it the day a generator adds a file kind, and
the user would see a file in the tree that the column claims their field does not touch.

`primary` and `secondary` are the same rows partitioned by declared significance and nothing else —
no branch on line text, command name, file extension, path spelling or row position. Within each
part the seam's line order is preserved.

Two details in that shape are worth understanding before changing it.

**The heading is two lines, in path order.** A real generated path wants 381px at 12px against a
260px rail, so the heading renders the **directory first** at 10px, dimmed and truncating at its
end, with the **leaf beneath it** at 11px, never truncated, and the full path on `title`. Five
generated files in a rich configuration are named `contract.rs`; the directory is the only thing
that tells them apart, so collapsing this to one line shows five identical headings for a field that
touches five modules.

Leaf-first was the earlier order and read as two unrelated facts — `deploy.sh`, then `scripts`.
Directory-first is the path itself wrapped across two lines, and the emphasis falls on the filename
instead of being split evenly between them. The joining `/` is a `::after` rule rather than text, so
it stays out of the DOM where the copy-ownership scan and the unit assertions read `directory` as
the generator's data; `title` already carries the joined-up path.

**The directory loses its middle, not its end.** It renders as a shrink-priority pair from
`splitDirectory` — everything before the last segment, then that last segment — with the head
yielding first, so a long path reads `contracts/modules/compl…/src` rather than
`contracts/modules/compliance-ini…`. End-truncation ate the segment **nearest the file**, which is
precisely the one that tells five files named `contract.rs` apart: it dropped the only informative
part and kept the prefix every path shares.

**The row index is captured over the unpartitioned list.** `IndexedRow` pairs each row with its
position in the file's full row list, before the split, and that index travels with the row into
whichever partition it lands in. Re-capturing the index inside each partition makes `primary[0]` and
`secondary[0]` collide on the key `path#0`; React reuses one row's DOM node for the other, and
activating a row under _Mentions_ reveals a different site's range. Nothing throws, and it
only reproduces for files with mixed significance — which the busiest field in the wizard does not
have. Pairing the index with the row makes the collision unrepresentable rather than merely avoided.

## The presentation is subtractive

Primary rows render first: unlabelled, unwrapped, no heading, no container, no marker. The secondary
heading (_Mentions_) and its list are the **only** things a secondary row contributes, and
they render only when there is at least one.

The consequence is the property worth having: a generator that declares no significance anywhere
produces one plain list per file and announces no group that does not exist. The measured worst-case
field — 26 sites across two files — is entirely primary, so the busiest case in the wizard reads
exactly as it would if the significance axis did not exist. A design that read well _because_ it
splits would fail exactly there.

The marker is the heading **word**. Tone is decoration layered on top of it and never the axis, so
the distinction survives a render with no colour at all.

The marker is one word — **Mentions** — beside a `MessageSquareQuote` glyph, with the explanatory
sentence (_Lines that show this value without deciding it_) carried as the heading's `title`. A
longer marker with that sentence rendered beneath it said the same thing twice, two lines deep, in a
260px rail; one word says it once and the sentence stays a hover away, still owned by the
dictionary. The heading's own text content is the marker word alone, which is what the
class-stripped assertion reads.
