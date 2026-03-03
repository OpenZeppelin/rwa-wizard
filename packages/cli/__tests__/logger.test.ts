import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../src/utils/logger';

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('info writes to stdout with the message', () => {
    logger.info('hello world');
    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain('hello world');
  });

  it('success writes to stdout', () => {
    logger.success('all done');
    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain('all done');
  });

  it('warn writes to stdout with "Warning:" prefix', () => {
    logger.warn('careful');
    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain('Warning: careful');
  });

  it('error writes to stderr with "Error:" prefix', () => {
    logger.error('broke');
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toContain('Error: broke');
  });

  it('blank writes an empty line', () => {
    logger.blank();
    expect(logSpy).toHaveBeenCalledWith('');
  });

  it('dim writes to stdout', () => {
    logger.dim('faded text');
    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain('faded text');
  });

  it('plain writes to stdout without formatting', () => {
    logger.plain('raw text');
    expect(logSpy).toHaveBeenCalledWith('raw text');
  });

  it('validationError writes to stderr with field and code', () => {
    logger.validationError('token.name', 'REQUIRED_FIELD', 'Name is required');
    expect(errorSpy).toHaveBeenCalledOnce();
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain('REQUIRED_FIELD');
    expect(output).toContain('token.name');
    expect(output).toContain('Name is required');
  });

  it('validationWarning writes to stdout with field and code', () => {
    logger.validationWarning('token.decimals', 'HIGH_VALUE', 'Unusually high');
    expect(logSpy).toHaveBeenCalledOnce();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('HIGH_VALUE');
    expect(output).toContain('token.decimals');
  });

  it('fileWritten writes to stdout', () => {
    logger.fileWritten('contracts/token.rs');
    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain('contracts/token.rs');
  });

  it('header writes formatted header to stdout', () => {
    logger.header('Section Title');
    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain('Section Title');
  });

  it('moduleEntry writes 4 lines (id, desc, hooks, blank)', () => {
    logger.moduleEntry('supply-cap', 'Supply Cap', 'Limits total supply', ['creation']);
    expect(logSpy).toHaveBeenCalledTimes(4);
    expect(logSpy.mock.calls[0][0]).toContain('supply-cap');
    expect(logSpy.mock.calls[1][0]).toContain('Supply Cap');
    expect(logSpy.mock.calls[2][0]).toContain('creation');
  });

  it('summary formats key-value pairs with aligned padding', () => {
    logger.summary([
      ['Key', 'value'],
      ['LongerKey', 42],
    ]);
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy.mock.calls[0][0]).toContain('Key');
    expect(logSpy.mock.calls[0][0]).toContain('value');
    expect(logSpy.mock.calls[1][0]).toContain('42');
  });
});
