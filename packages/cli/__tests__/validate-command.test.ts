import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validateCommand } from '../src/commands/validate';
import { getGenerator } from '../src/generators/registry';
import { loadConfig } from '../src/utils/config-loader';
import { logger } from '../src/utils/logger';
import { createMockAdapter, createValidConfig } from './helpers';

vi.mock('../src/generators/registry');
vi.mock('../src/utils/config-loader');
vi.mock('../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    header: vi.fn(),
    blank: vi.fn(),
    success: vi.fn(),
    validationError: vi.fn(),
    validationWarning: vi.fn(),
  },
}));

class ExitError extends Error {
  constructor(public code: number | undefined) {
    super(`process.exit(${code})`);
  }
}

describe('validateCommand', () => {
  const mockAdapter = createMockAdapter();
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitError(code as number);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGenerator).mockReturnValue(mockAdapter);
    vi.mocked(loadConfig).mockReturnValue(createValidConfig());
  });

  it('should report valid config and not exit', () => {
    vi.mocked(mockAdapter.validate).mockReturnValue({ valid: true, errors: [], warnings: [] });
    validateCommand({ config: 'test.json', chain: 'stellar' });

    expect(logger.success).toHaveBeenCalledWith('Configuration is valid');
  });

  it('should pass allowUnderReviewModules to validate', () => {
    vi.mocked(mockAdapter.validate).mockReturnValue({ valid: true, errors: [], warnings: [] });
    validateCommand({
      config: 'test.json',
      chain: 'stellar',
      allowUnderReviewModules: true,
    });

    expect(mockAdapter.validate).toHaveBeenCalledWith(expect.any(Object), {
      allowUnderReviewModules: true,
    });
  });

  it('should exit with code 1 on invalid config', () => {
    vi.mocked(mockAdapter.validate).mockReturnValue({
      valid: false,
      errors: [{ field: 'token.name', code: 'REQUIRED_FIELD', message: 'Name required' }],
      warnings: [],
    });

    expect(() => validateCommand({ config: 'test.json', chain: 'stellar' })).toThrow(ExitError);
    expect(logger.validationError).toHaveBeenCalledWith(
      'token.name',
      'REQUIRED_FIELD',
      'Name required'
    );
    expect(logger.error).toHaveBeenCalledWith('Configuration is invalid');
  });

  it('should display warnings without exiting', () => {
    vi.mocked(mockAdapter.validate).mockReturnValue({
      valid: true,
      errors: [],
      warnings: [{ field: 'token.decimals', code: 'HIGH_VALUE', message: 'Unusually high' }],
    });
    validateCommand({ config: 'test.json', chain: 'stellar' });

    expect(logger.validationWarning).toHaveBeenCalled();
    expect(logger.success).toHaveBeenCalledWith('Configuration is valid');
  });

  it('should display both errors and warnings', () => {
    vi.mocked(mockAdapter.validate).mockReturnValue({
      valid: false,
      errors: [{ field: 'x', code: 'ERR', message: 'error' }],
      warnings: [{ field: 'y', code: 'WARN', message: 'warning' }],
    });

    expect(() => validateCommand({ config: 'test.json', chain: 'stellar' })).toThrow(ExitError);
    expect(logger.validationWarning).toHaveBeenCalled();
    expect(logger.validationError).toHaveBeenCalled();
  });

  it('should exit with code 1 on unknown chain', () => {
    vi.mocked(getGenerator).mockImplementation(() => {
      throw new Error('Unknown chain "bad"');
    });

    expect(() => validateCommand({ config: 'test.json', chain: 'bad' })).toThrow(ExitError);
    expect(logger.error).toHaveBeenCalledWith('Unknown chain "bad"');
  });

  it('should exit with code 1 on missing config file', () => {
    vi.mocked(loadConfig).mockImplementation(() => {
      throw new Error('Config file not found: /path/test.json');
    });

    expect(() => validateCommand({ config: 'test.json', chain: 'stellar' })).toThrow(ExitError);
    expect(logger.error).toHaveBeenCalledWith('Config file not found: /path/test.json');
  });
});
