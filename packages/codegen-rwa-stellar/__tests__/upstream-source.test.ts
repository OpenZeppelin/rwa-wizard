import { afterEach, describe, expect, it } from 'vitest';

import { resolveUpstreamTemplateSource } from '../src/upstream/source';

const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');

function setProcessMock(processValue: unknown): void {
  Object.defineProperty(globalThis, 'process', {
    configurable: true,
    writable: true,
    value: processValue,
  });
}

afterEach(() => {
  if (originalProcessDescriptor) {
    Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
    return;
  }

  delete (globalThis as { process?: unknown }).process;
});

describe('resolveUpstreamTemplateSource', () => {
  it('falls back to the bundled snapshot outside Node even when contractsLibraryPath is provided', () => {
    setProcessMock(undefined);

    const source = resolveUpstreamTemplateSource({
      contractsLibraryPath: '/tmp/stellar-contracts',
    });

    expect(source.metadata.strategy).toBe('bundled-snapshot');
  });

  it('throws when a Node runtime cannot honor contractsLibraryPath', () => {
    setProcessMock({ versions: { node: '20.19.0' } });

    expect(() =>
      resolveUpstreamTemplateSource({
        contractsLibraryPath: '/tmp/stellar-contracts',
      })
    ).toThrow('process.getBuiltinModule()');
  });
});
