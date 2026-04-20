# Contract: Draft Storage

## Purpose

Defines the app-local persistence contract for wizard drafts. This contract is implemented on top of `@openzeppelin/ui-storage` and is the only path by which the UI reads or writes persisted drafts.

## Responsibilities

- Persist multiple local drafts in IndexedDB
- Expose list/create/resume/rename/delete operations
- Support autosave updates
- Support export/import of versioned draft payloads
- Preserve the current in-memory session when storage errors occur

## Interface

```ts
interface WizardDraftStorage {
  list(): Promise<DraftListItem[]>;
  get(id: string): Promise<WizardDraftRecord | undefined>;
  create(input: CreateDraftInput): Promise<string>;
  save(id: string, patch: SaveDraftPatch): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  remove(id: string): Promise<void>;
  export(ids?: string[]): Promise<string>;
  import(json: string): Promise<string[]>;
}
```

## Behavioral Rules

- Meaningful draft content means at least one persisted wizard field value has been intentionally set, a draft has been imported, or the draft has been explicitly named by the user.
- `create(...)` is called only after meaningful draft content exists.
- `save(...)` must update `updatedAt`.
- `rename(...)` must preserve user-provided titles during later autosave cycles.
- `remove(...)` must act only on the addressed local draft and should be paired with explicit UI confirmation.
- `export(...)` returns a versioned JSON envelope, not a raw record dump.
- `import(...)` creates new draft IDs and must not merge content into the currently open draft.

## Error Semantics

| Operation         | Error Condition                                                | Expected UI Outcome                                                              |
| ----------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `create` / `save` | IndexedDB unavailable or quota issue                           | Keep current in-memory session usable and show an actionable persistence warning |
| `get` / `list`    | Database open/read failure                                     | Show empty/error state without crashing the app shell                            |
| `export`          | No meaningful drafts or serialization failure                  | Show export failure and keep drafts unchanged                                    |
| `import`          | Invalid JSON, wrong version, empty payload, unsupported config | Reject import, preserve current draft unchanged, and explain why                 |

## Test Expectations

- Autosave updates the latest meaningful draft without creating duplicate empty drafts
- Import creates new draft IDs
- Export excludes empty placeholder drafts
- Delete removes only the chosen draft
- Storage failures do not destroy the current unsaved UI state
