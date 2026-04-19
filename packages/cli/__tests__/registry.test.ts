import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GeneratorAdapter } from '../src/generators/registry';
import { createMockHints } from './helpers';

describe('Generator Registry', () => {
  let registerGenerator: typeof import('../src/generators/registry').registerGenerator;
  let getGenerator: typeof import('../src/generators/registry').getGenerator;
  let getAvailableChains: typeof import('../src/generators/registry').getAvailableChains;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/generators/registry');
    registerGenerator = mod.registerGenerator;
    getGenerator = mod.getGenerator;
    getAvailableChains = mod.getAvailableChains;
  });

  function mockAdapter(chain: string): GeneratorAdapter {
    return {
      name: `${chain} Generator`,
      chain,
      hints: createMockHints(),
      generate: vi.fn() as GeneratorAdapter['generate'],
      validate: vi.fn() as GeneratorAdapter['validate'],
      generateZip: vi.fn() as GeneratorAdapter['generateZip'],
      getAvailableModules: vi.fn().mockReturnValue([]),
    };
  }

  it('should register and retrieve an adapter by chain name', () => {
    const adapter = mockAdapter('test-chain');
    registerGenerator(adapter);

    const retrieved = getGenerator('test-chain');
    expect(retrieved).toBe(adapter);
    expect(retrieved.name).toBe('test-chain Generator');
  });

  it('should throw for an unregistered chain', () => {
    expect(() => getGenerator('nonexistent')).toThrow('Unknown chain "nonexistent"');
  });

  it('should include available chains in the error message', () => {
    registerGenerator(mockAdapter('alpha'));
    registerGenerator(mockAdapter('beta'));
    expect(() => getGenerator('missing')).toThrow('alpha, beta');
  });

  it('should show "(none registered)" when registry is empty', () => {
    expect(() => getGenerator('any')).toThrow('(none registered)');
  });

  it('should return all registered chain names', () => {
    registerGenerator(mockAdapter('a'));
    registerGenerator(mockAdapter('b'));
    registerGenerator(mockAdapter('c'));
    expect(getAvailableChains()).toEqual(['a', 'b', 'c']);
  });

  it('should return an empty array when no chains are registered', () => {
    expect(getAvailableChains()).toEqual([]);
  });

  it('should overwrite adapter on duplicate chain registration', () => {
    const first = mockAdapter('chain');
    const second = { ...mockAdapter('chain'), name: 'Updated Generator' };

    registerGenerator(first);
    registerGenerator(second);

    expect(getGenerator('chain').name).toBe('Updated Generator');
    expect(getAvailableChains()).toEqual(['chain']);
  });
});
