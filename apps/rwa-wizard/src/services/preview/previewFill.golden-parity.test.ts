/**
 * SF-4 AS-1 — the `preview-filled-empty-draft` golden fixture mirrors the wizard.
 *
 * The codegen package cannot import from the app, so the fixture is a literal
 * copy of `createDefaultRwaConfig()` after the preview fill. This test closes the
 * loop from the app side: the bytes the wizard's live preview produces for the
 * empty draft must equal the committed goldens for that fixture, on both paths.
 * If either `createDefaultRwaConfig`, the preview sentinels, or the fixture
 * literal drifts, this fails with the first differing file.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { stellarPreviewCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { loadCodegenService } from '../codegen/codegenLoader';
import { toPreviewConfig } from './toPreviewConfig';

const GOLDENS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'codegen-rwa-stellar',
  '__tests__',
  'golden',
  '__goldens__'
);
const FIXTURE = 'preview-filled-empty-draft';

const PATHS = [
  { dir: 'generate', includeIdentitySupport: false },
  { dir: 'generate-with-identity-support', includeIdentitySupport: true },
] as const;

/**
 * The live wizard always records provenance (`useCodePreview` passes
 * `recordProvenance: true`), so the goldens must hold on that path too, not only
 * on the bare call the package tests use.
 */
const RECORDING = [{ recordProvenance: false }, { recordProvenance: true }] as const;

function readGoldenTree(dir: string): Record<string, string> {
  const tree: Record<string, string> = {};
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const full = join(entry.parentPath, entry.name);
      tree[relative(dir, full)] = readFileSync(full, 'utf8');
    }
  }
  return tree;
}

describe('preview-filled empty draft matches its golden fixture (SF-4 AS-1)', () => {
  it('the fixture goldens exist for both paths', () => {
    for (const path of PATHS) {
      expect(existsSync(join(GOLDENS_DIR, path.dir, FIXTURE)), path.dir).toBe(true);
    }
  });

  it.each(PATHS.flatMap((path) => RECORDING.map((recording) => ({ ...path, ...recording }))))(
    '$dir (recordProvenance: $recordProvenance): wizard preview bytes equal the golden bytes',
    async (path) => {
      const service = await loadCodegenService('stellar');
      expect(service).not.toBeNull();
      if (service === null) return;

      const { config, substitutedKeys } = toPreviewConfig(
        createDefaultRwaConfig(),
        stellarPreviewCatalog()
      );
      // The empty draft must actually have been filled; otherwise this compares the
      // wrong thing against the fixture.
      expect(substitutedKeys).toEqual([
        'token.name',
        'token.symbol',
        'accessControl.ownership.ownerAddress',
      ]);

      const { files } = await service.generateFileTree(config, {
        includeIdentitySupport: path.includeIdentitySupport,
        recordProvenance: path.recordProvenance,
      });
      const golden = readGoldenTree(join(GOLDENS_DIR, path.dir, FIXTURE));

      expect(Object.keys(files).sort()).toEqual(Object.keys(golden).sort());
      for (const [file, content] of Object.entries(files)) {
        expect(typeof content, file).toBe('string');
        expect(content, `${path.dir}/${FIXTURE}/${file}`).toBe(golden[file]);
      }
    }
  );
});
