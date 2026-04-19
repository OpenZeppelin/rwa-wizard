# Contract: Target Catalog

## Purpose

Defines how the app exposes available and future target ecosystems to the UI. The contract separates selector-safe metadata from heavy runtime loading so the sidebar target selector can render immediately.

## Responsibilities

- Return ordered target metadata synchronously for selector rendering
- Expose feature flags for enabled, hidden, or coming-soon targets
- Lazy-load target runtime behavior only for actionable targets
- Normalize disabled target presentation across the app

## Interface

```ts
interface TargetCatalogService {
  listTargets(): TargetCatalogEntry[];
  getTarget(id: string): TargetCatalogEntry | undefined;
  loadRuntime(id: string): Promise<LoadedTargetRuntime>;
}
```

## `TargetCatalogEntry`

```ts
interface TargetCatalogEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  showInUI: boolean;
  disabledLabel?: string;
  disabledDescription?: string;
  packageName: string;
}
```

## `LoadedTargetRuntime`

```ts
interface LoadedTargetRuntime {
  targetId: string;
  codegenService: RwaCodegenService;
}
```

## Behavioral Rules

- `listTargets()` must be synchronous and safe on first render.
- `showInUI = false` hides a target entirely from the selector.
- `enabled = false` and `showInUI = true` renders a visible-disabled target with a clear label such as `Coming Soon`.
- `loadRuntime(id)` must reject attempts to load hidden or unsupported targets.
- The first iteration must return `stellar` as enabled and future entries such as `evm` as visible-disabled.

## Error Semantics

| Operation     | Error Condition           | Expected UI Outcome                                                                  |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `getTarget`   | Unknown target ID         | Show fallback error state and keep current target unchanged                          |
| `loadRuntime` | Disabled target requested | Keep selector visible but prevent entering unsupported flow                          |
| `loadRuntime` | Runtime import failure    | Show load error for that target and allow retry without breaking the rest of the app |

## Test Expectations

- Target order is deterministic
- Stellar is actionable in the first iteration
- Disabled targets remain visible but not selectable
- Lazy runtime failures clear retry state instead of permanently poisoning the target cache
