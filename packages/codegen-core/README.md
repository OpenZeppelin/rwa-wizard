# @openzeppelin/codegen-core

Chain-agnostic code generation pipeline engine. Provides file tree assembly, ZIP packaging, a composable validation framework, and progress reporting — used as the foundation for all OpenZeppelin code generators.

## Install

```bash
npm install @openzeppelin/codegen-core
```

## API Reference

### Generation Pipeline

#### `generateZip(result, rootDirName, options?)`

Packages a `GenerationResult` (file tree + metadata) into a ZIP archive.

```typescript
import { generateZip } from '@openzeppelin/codegen-core';

const zipResult = await generateZip(generationResult, 'my-project', {
  onProgress: (event) => console.log(`${event.phase}: ${event.percentage}%`),
});

// zipResult.data — Blob (browser) or Buffer-backed Blob (Node.js)
// zipResult.fileName — e.g. "my-project.zip"
// zipResult.metadata — GenerationMetadata
```

### Validation Framework

#### `createValidationRule(name, fn)`

Creates a named validation rule from a function that receives the config and returns errors/warnings.

#### `composeValidationRules(...rules)`

Composes multiple validation rules into a single rule set.

#### `validateWithRules(config, rules)`

Runs all composed rules against a config and returns a `ValidationResult`.

```typescript
import {
  composeValidationRules,
  createValidationRule,
  validateWithRules,
} from '@openzeppelin/codegen-core';

const nameRule = createValidationRule('name-check', (config) => {
  const errors = [];
  if (!config.name) {
    errors.push({ field: 'name', code: 'REQUIRED', message: 'Name is required' });
  }
  return { errors, warnings: [] };
});

const rules = composeValidationRules(nameRule);
const result = validateWithRules(myConfig, rules);
// result.valid, result.errors, result.warnings
```

### File Tree Utilities

#### `createFile(path, content)`

Creates a `FileTree` with a single file entry.

#### `mergeFileTrees(...trees)`

Merges multiple `FileTree` objects (later entries override earlier ones on conflict).

#### `addFile(tree, path, content)`

Returns a new `FileTree` with the given file added.

#### `prefixPaths(tree, prefix)`

Returns a new `FileTree` with all paths prefixed by the given directory.

#### `getFilePaths(tree)` / `getFileCount(tree)`

Query helpers for `FileTree` contents.

```typescript
import { createFile, mergeFileTrees, prefixPaths } from '@openzeppelin/codegen-core';

const src = mergeFileTrees(
  createFile('lib.rs', '#![no_std]'),
  createFile('contract.rs', '// contract code')
);

const prefixed = prefixPaths(src, 'contracts/token/src');
// { "contracts/token/src/lib.rs": "...", "contracts/token/src/contract.rs": "..." }
```

### Progress Utilities

#### `createProgressEvent(phase, percentage, message?)`

Factory for `ProgressEvent` objects.

#### `resolveProgressCallback(cb?)`

Returns the provided callback or a no-op default — safe to call unconditionally.

### Generator Interface

All generators implement the `Generator<TConfig>` interface:

```typescript
import type { GenerationResult, Generator, ValidationResult } from '@openzeppelin/codegen-core';

class MyGenerator implements Generator<MyConfig> {
  readonly name = 'my-generator';
  readonly version = '1.0.0';

  validate(config: MyConfig): ValidationResult {
    /* ... */
  }
  generate(config: MyConfig, options?): GenerationResult {
    /* ... */
  }
}
```

## Types

| Type                 | Description                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| `FileTree`           | `Record<string, string \| Uint8Array>` — in-memory project structure      |
| `Generator<TConfig>` | Interface for code generators                                             |
| `ValidationResult`   | `{ valid, errors, warnings }`                                             |
| `ValidationError`    | `{ field, code, message }`                                                |
| `ValidationWarning`  | `{ field, code, message }`                                                |
| `GenerationResult`   | `{ files: FileTree, metadata }`                                           |
| `GenerationMetadata` | `{ generatorName, generatorVersion, generatedAt, fileCount, configHash }` |
| `ZipResult`          | `{ data: Blob, fileName, metadata }`                                      |
| `ProgressEvent`      | `{ phase, percentage, message? }`                                         |
| `ProgressCallback`   | `(event: ProgressEvent) => void`                                          |
| `GenerateOptions`    | `{ onProgress?: ProgressCallback }`                                       |

## License

AGPL-3.0 — OpenZeppelin
