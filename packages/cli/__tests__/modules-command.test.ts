import { beforeEach, describe, expect, it, vi } from 'vitest';

import { modulesCommand } from '../src/commands/modules';
import { getGenerator } from '../src/generators/registry';
import { logger } from '../src/utils/logger';
import { createMockAdapter } from './helpers';

vi.mock('../src/generators/registry');
vi.mock('../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    header: vi.fn(),
    moduleEntry: vi.fn(),
  },
}));

class ExitError extends Error {
  constructor(public code: number | undefined) {
    super(`process.exit(${code})`);
  }
}

describe('modulesCommand', () => {
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitError(code as number);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display info when no modules are available', () => {
    const adapter = createMockAdapter();
    vi.mocked(adapter.getAvailableModules).mockReturnValue([]);
    vi.mocked(getGenerator).mockReturnValue(adapter);

    modulesCommand({ chain: 'stellar' });

    expect(logger.info).toHaveBeenCalledWith('No compliance modules available for this chain.');
    expect(logger.moduleEntry).not.toHaveBeenCalled();
  });

  it('should list each available module', () => {
    const modules = [
      {
        id: 'supply-cap',
        name: 'Supply Cap',
        description: 'Limits total supply',
        supportedHooks: ['creation'],
      },
      {
        id: 'transfer-limit',
        name: 'Transfer Limit',
        description: 'Limits transfer amounts',
        supportedHooks: ['transfer'],
      },
    ];
    const adapter = createMockAdapter();
    vi.mocked(adapter.getAvailableModules).mockReturnValue(modules);
    vi.mocked(getGenerator).mockReturnValue(adapter);

    modulesCommand({ chain: 'stellar' });

    expect(logger.header).toHaveBeenCalled();
    expect(logger.moduleEntry).toHaveBeenCalledTimes(2);
    expect(logger.moduleEntry).toHaveBeenCalledWith(
      'supply-cap',
      'Supply Cap',
      'Limits total supply',
      ['creation']
    );
  });

  it('should exit with code 1 on unknown chain', () => {
    vi.mocked(getGenerator).mockImplementation(() => {
      throw new Error('Unknown chain "bad"');
    });

    expect(() => modulesCommand({ chain: 'bad' })).toThrow(ExitError);
    expect(logger.error).toHaveBeenCalledWith('Unknown chain "bad"');
  });
});
