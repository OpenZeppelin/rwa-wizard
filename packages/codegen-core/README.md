# @openzeppelin/codegen-core

Chain-agnostic code generation primitives used by OpenZeppelin generators. This package owns the shared infrastructure layer: file trees, ZIP assembly, validation composition, progress reporting, deterministic config hashing, exact source patching, and template-source abstractions.

## Install

```bash
npm install @openzeppelin/codegen-core
```

## What This Package Owns

- File tree assembly and path manipulation
- ZIP packaging from `GenerationResult`
- Validation rule composition and result shaping
- Progress callback helpers
- Deterministic config serialization and hashing
- Exact-match source patch helpers
- Snapshot-backed template source abstractions

## API Reference

### Generation Pipeline

#### `generateZip(result, rootDirName, options?)`

Packages a `GenerationResult` into a ZIP archive rooted under `rootDirName`.

```typescript
import { generateZip } from '@openzeppelin/codegen-core';

const zipResult = await generateZip(generationResult, 'my-project', {
  onProgress: (event) => console.log(`${event.phase}: ${event.percentage}%`),
});
```

### Validation Framework

#### `createValidationRule(fn)`

Creates a typed validation rule from a function that returns `{ errors, warnings }`.

#### `composeValidationRules(...rules)`

Combines multiple rules into a single validation rule.

#### `validateWithRules(config, rules)`

Runs rules against a config and produces a `ValidationResult`.

```typescript
import {
  composeValidationRules,
  createValidationRule,
  validateWithRules,
} from '@openzeppelin/codegen-core';

const nameRule = createValidationRule<{ name: string }>((config) => {
  return config.name
    ? { errors: [], warnings: [] }
    : {
        errors: [{ field: 'name', code: 'REQUIRED_FIELD', message: 'Name is required' }],
        warnings: [],
      };
});

const combinedRule = composeValidationRules(nameRule);
const result = validateWithRules({ name: '' }, [combinedRule]);
```

### File Tree Utilities

- `createFile(path, content)`
- `mergeFileTrees(...trees)`
- `addFile(tree, path, content)`
- `prefixPaths(tree, prefix)`
- `getFilePaths(tree)`
- `getFileCount(tree)`

```typescript
import { createFile, mergeFileTrees, prefixPaths } from '@openzeppelin/codegen-core';

const tree = mergeFileTrees(createFile('src/main.txt', 'hello'), createFile('README.md', '# Demo'));
const rooted = prefixPaths(tree, 'demo-project');
```

### Determinism Utilities

- `sortObjectKeys(value)`
- `stableJsonStringify(value)`
- `computeConfigHash(value)`
- `hashString(value)`

```typescript
import { computeConfigHash, stableJsonStringify } from '@openzeppelin/codegen-core';

const json = stableJsonStringify({ b: 2, a: 1 });
const hash = computeConfigHash({ b: 2, a: 1 });
```

### Source Patch Helpers

- `replaceExact(source, search, replacement)`
- `insertBeforeExact(source, marker, insertion)`
- `insertAfterExact(source, marker, insertion)`

These helpers fail fast when the expected source marker disappears, which makes upstream template drift explicit during generation.

### Template Source Helpers

- `getTemplateSourceKey(kind, id)`
- `assertTemplateSnapshotCompleteness(snapshot, manifest)`
- `createSnapshotTemplateSource(snapshot, metadata)`

```typescript
import {
  createSnapshotTemplateSource,
  getTemplateSourceKey,
  type TemplateSnapshot,
} from '@openzeppelin/codegen-core';

const snapshot: TemplateSnapshot = {
  metadata: {
    sourceRepoUrl: 'https://example.com/repo.git',
    sourceCommitHash: 'abc123',
    syncedAt: '2026-01-01T00:00:00.000Z',
  },
  templates: {
    [getTemplateSourceKey('contract', 'token')]: {
      sourcePath: 'fixtures/token.txt',
      content: 'template contents',
    },
  },
};

const source = createSnapshotTemplateSource(snapshot, {
  ...snapshot.metadata,
  strategy: 'bundled-snapshot',
});
```

### Progress Utilities

- `createProgressEvent(phase, percentage, message?)`
- `resolveProgressCallback(callback?)`

### Generator Interface

All generators implement `Generator<TConfig>`.

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

## Shared Types

Notable exported types include:

- `FileTree`
- `ValidationResult`, `ValidationError`, `ValidationWarning`
- `GenerationResult`, `GenerationMetadata`, `ZipResult`
- `ProgressEvent`, `ProgressCallback`
- `GenerateOptions`
- `TemplateSnapshot`, `TemplateSource`, `TemplateManifestEntry`

`GenerateOptions` currently includes:

- `onProgress`: shared progress callback
- `contractsLibraryPath`: optional local upstream checkout path for generators that support it
- `allowUnderReviewModules`: optional policy override for generators that gate unfinished modules

## License

AGPL-3.0 — OpenZeppelin
