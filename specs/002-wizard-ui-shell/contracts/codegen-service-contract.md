# Contract: Codegen Service

## Purpose

Defines the single app-local boundary between the React UI shell and real or mock codegen implementations. Components interact with this contract only; they do not call generator packages directly.

## Responsibilities

- Validate draft configuration against the selected target
- Expose target-specific module availability
- Generate downloadable ZIP results for successful handoff
- Normalize progress and error shapes for the UI
- Allow mock and real implementations to be swapped transparently

## Interface

```ts
interface RwaCodegenService {
  validate(config: RWAConfig): Promise<ValidationResult>;
  getAvailableModules(): Promise<ComplianceModuleOption[]>;
  generateZip(
    config: RWAConfig,
    options?: { onStatus?: (status: GenerationStatus) => void }
  ): Promise<GeneratedZipArtifact>;
}
```

## Supporting Types

```ts
interface ComplianceModuleOption {
  id: string;
  name: string;
  description: string;
  supportedHooks: Array<'transfer' | 'creation' | 'destruction'>;
}

interface GenerationStatus {
  phase: 'validating' | 'generating' | 'packaging' | 'success' | 'error';
  message?: string;
}

interface GeneratedZipArtifact {
  fileName: string;
  data: Blob;
}
```

## Real Implementation Rules

- The first real implementation is backed by `@openzeppelin/codegen-rwa-stellar`.
- The service must accept and return the canonical package-level types wherever possible.
- The UI shell must not recreate target-specific validation rules locally.
- ZIP delivery is the primary successful outcome for the first iteration.

## Mock Implementation Rules

- Mocks must preserve the same input/output contract as the real service.
- Mock validation results, module catalogs, and ZIP outputs must be deterministic and documented in the mock gap register.
- Components must not need to know whether they are using a real or mock codegen service.

## Error Semantics

| Operation             | Error Condition              | Expected UI Outcome                                                                              |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `validate`            | Generator validation failure | Return structured field errors and keep the user in the wizard                                   |
| `getAvailableModules` | Runtime unavailable          | Show an empty or fallback module state without breaking other steps                              |
| `generateZip`         | Real generator unavailable   | Use documented mock only if the gap is explicitly tracked; otherwise show generation unavailable |
| `generateZip`         | ZIP delivery failure         | Show generation failure and do not imply the file was downloaded                                 |

## Test Expectations

- Real and mock implementations satisfy the same contract
- Validation errors map cleanly to field-level UI states
- Generated ZIP success produces a browser-downloadable artifact
- Generator failure never destroys the current draft
