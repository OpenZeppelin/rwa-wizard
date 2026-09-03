# Contract: Codegen Service

## Purpose

Defines the single app-local boundary between the React UI shell and real or mock codegen implementations. Components interact with this contract only; they do not call generator packages directly.

## Responsibilities

- Validate draft configuration against the selected target
- Expose target-specific module availability
- Generate downloadable ZIP results for successful handoff
- Generate an in-memory file tree for preview that matches the ZIP (same generators, identity toggle)
- Normalize progress and error shapes for the UI
- Allow mock and real implementations to be swapped transparently

## Interface

```ts
interface GenerateArtifactOptions {
  onStatus?: (status: GenerationStatus) => void;
  includeIdentitySupport?: boolean;
}

interface GeneratedFileTreeArtifact {
  files: FileTree; // project-relative keys from GenerationResult.files, not ZIP entry names
}

interface RwaCodegenService {
  validate(config: RWAConfig): Promise<ValidationResult>;
  getAvailableModules(): Promise<ComplianceModuleOption[]>;
  generateZip(config: RWAConfig, options?: GenerateArtifactOptions): Promise<GeneratedZipArtifact>;
  generateFileTree(
    config: RWAConfig,
    options?: GenerateArtifactOptions
  ): Promise<GeneratedFileTreeArtifact>;
  getGeneratedFileKind?: (path: string) => StructuralGeneratedFileKind;
}
```

## Supporting Types

```ts
type ModuleReviewState = 'stable' | 'under-review';

interface ModuleReviewInfo {
  state: ModuleReviewState;
  prUrl?: string;
}

interface ModuleConfigFieldMeta {
  key: string;
  label: string;
  type: 'string' | 'number' | 'string[]';
  required: boolean;
  placeholder?: string;
  hint?: string;
}

interface ComplianceModuleOption {
  id: string;
  name: string;
  description: string;
  requiredHooks: string[];
  review: ModuleReviewInfo;
  configFields: ModuleConfigFieldMeta[];
}

type SummaryPhase = 'validating' | 'generating' | 'packaging' | 'success' | 'error';

interface GenerationStatus {
  phase: SummaryPhase;
  message?: string;
}

interface GeneratedZipArtifact {
  fileName: string;
  data: Blob;
}

type FileTree = Record<string, string | Uint8Array>;

type StructuralGeneratedFileKind = 'contract' | 'script' | 'provenance-and-docs' | 'unknown';
```

## Real Implementation Rules

- The first real implementation is backed by `@openzeppelin/codegen-rwa-stellar`.
- The service must accept and return the canonical package-level types wherever possible.
- The UI shell must not recreate target-specific validation rules locally.
- ZIP delivery remains the download outcome. Preview uses `generateFileTree`, which calls package `generate` / `generateWithIdentitySupport` — never unzipping.
- Tree keys are generator paths. JSZip adds one root folder named from the sanitized token symbol. SC-002 compares maps after stripping that single ZIP prefix.
- `generateFileTree` throws `CodegenInvalidConfigError` (`CODEGEN_INVALID_CONFIG`), `CodegenGenerationError` (`CODEGEN_GENERATION_FAILED`), or `CodegenUnsupportedError` (`CODEGEN_GENERATE_UNSUPPORTED`). Callers catch; the method still rejects rather than returning a partial tree.
- Optional `getGeneratedFileKind(path)` reports the generator's ranking kind (`contract` | `script` | `provenance-and-docs` | `unknown`) for a project-relative path. Omitted by targets that do not classify. Callers treat a missing method as `unknown` for every path and must not recover a kind from the filename. The loader narrows an unrecognized package string to `unknown` for that path and warns; it does not drop the file or disable ranking for other paths.

## Mock Implementation Rules

- Mocks must preserve the same input/output contract as the real service.
- Mock validation results, module catalogs, and ZIP outputs must be deterministic and documented in the mock gap register.
- `createTestCodegenService` accepts optional `fileKinds`. Lookup uses that map, else `unknown`. The double must not hardcode Stellar paths as kind keys.
- Components must not need to know whether they are using a real or mock codegen service.

## Error Semantics

| Operation             | Error Condition              | Expected UI Outcome                                                                              |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `validate`            | Generator validation failure | Return structured field errors and keep the user in the wizard                                   |
| `getAvailableModules` | Runtime unavailable          | Show an empty or fallback module state without breaking other steps                              |
| `generateZip`         | Real generator unavailable   | Use documented mock only if the gap is explicitly tracked; otherwise show generation unavailable |
| `generateZip`         | ZIP delivery failure         | Show generation failure and do not imply the file was downloaded                                 |
| `generateFileTree`    | Invalid config after fill    | Throw `CodegenInvalidConfigError`; UI shows structured preview error, React tree does not crash  |
| `generateFileTree`    | Other generator failure      | Throw `CodegenGenerationError`                                                                   |
| `generateFileTree`    | Package has no `generate`    | Throw `CodegenUnsupportedError`; do not fall back to unzipping                                   |

## Test Expectations

- Real and mock implementations satisfy the same contract
- Validation errors map cleanly to field-level UI states
- Generated ZIP success produces a browser-downloadable artifact
- For a real stellar service, unzip + strip one root folder + compare keys and bytes against `generateFileTree` (identity on and off). Do not assert that parity against `createTestCodegenService` (its Blob is not a JSZip archive)
- Generator failure never destroys the current draft
