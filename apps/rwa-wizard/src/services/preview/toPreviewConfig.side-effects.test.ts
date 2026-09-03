import { afterEach, describe, expect, it, vi } from 'vitest';

import { supplyLimitCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { toPreviewConfig } from './index';

describe('toPreviewConfig side effects (INV-13)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not log or write storage while filling', () => {
    const log = vi.spyOn(console, 'log');
    const info = vi.spyOn(console, 'info');
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    const debug = vi.spyOn(console, 'debug');
    const setItem = vi.spyOn(window.localStorage, 'setItem');

    toPreviewConfig(createDefaultRwaConfig(), supplyLimitCatalog);

    expect(log, 'INV-13: shim must not log; SF-8 may log substitutedKeys').not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
    expect(setItem, 'INV-13: filled clone must not be persisted').not.toHaveBeenCalled();
  });
});
