import { describe, expect, it } from 'vitest';

import { assertTreeMatchesZip, fileContentsEqual } from '../../test/helpers/fileTreeParity';
import { completeDraft, stellarPreviewCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { toPreviewConfig } from '../preview';
import { loadCodegenService } from './codegenLoader';
import { createTestCodegenService } from './testCodegenService';

describe('generateFileTree ZIP parity (INV-6, SC-002)', () => {
  it('matches identity-off ZIP keys and bytes after stripping one root folder', async () => {
    const service = await loadCodegenService('stellar');
    expect(service).not.toBeNull();
    const { config } = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    await assertTreeMatchesZip(service!, config, false);
  });

  it('matches identity-on ZIP keys and bytes after stripping one root folder', async () => {
    const service = await loadCodegenService('stellar');
    expect(service).not.toBeNull();
    const { config } = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    await assertTreeMatchesZip(service!, config, true);
  });

  it('does not treat the test double Blob as a ZIP (INV-6 out of scope for the double)', async () => {
    const double = createTestCodegenService();
    const zip = await double.generateZip(completeDraft());
    await expect(zip.data.arrayBuffer()).resolves.toBeTruthy();
    expect(zip.data.type).toBe('application/zip');
    const text = await zip.data.text();
    expect(text.startsWith('PK'), 'dummy Blob is not a real archive').toBe(false);
  });

  it('compares mixed string and Uint8Array contents as specified (INV-6 helper)', () => {
    const bytes = new TextEncoder().encode('hello');
    expect(fileContentsEqual('hello', 'hello')).toBe(true);
    expect(fileContentsEqual(bytes, bytes)).toBe(true);
    expect(fileContentsEqual('hello', bytes)).toBe(true);
    expect(fileContentsEqual('hello', new TextEncoder().encode('world'))).toBe(false);
  });
});
