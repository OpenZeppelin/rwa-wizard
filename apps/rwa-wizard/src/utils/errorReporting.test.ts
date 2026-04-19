import { describe, expect, it } from 'vitest';

import { getErrorMessage, toError } from './errorReporting';

describe('errorReporting', () => {
  describe('toError', () => {
    it('returns the same instance when given an Error', () => {
      const err = new Error('boom');
      expect(toError(err)).toBe(err);
    });

    it('preserves Error subclasses', () => {
      class MyError extends Error {}
      const err = new MyError('typed');
      const result = toError(err);
      expect(result).toBeInstanceOf(MyError);
    });

    it('wraps strings into Errors', () => {
      const result = toError('nope');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('nope');
    });

    it('JSON-serializes plain objects', () => {
      const result = toError({ code: 42 });
      expect(result.message).toBe('{"code":42}');
    });

    it('falls back to String() for non-serializable values', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const result = toError(circular);
      expect(result).toBeInstanceOf(Error);
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('getErrorMessage', () => {
    it('returns the Error message when present', () => {
      expect(getErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('falls back when the Error message is empty', () => {
      expect(getErrorMessage(new Error(''))).toBe('An unexpected error occurred.');
    });

    it('returns the raw string when given one', () => {
      expect(getErrorMessage('nope')).toBe('nope');
    });

    it('uses the supplied fallback for nullish values', () => {
      expect(getErrorMessage(null, 'custom')).toBe('custom');
      expect(getErrorMessage(undefined, 'custom')).toBe('custom');
    });

    it('serializes numbers and other primitives to strings', () => {
      expect(getErrorMessage(42)).toBe('42');
    });
  });
});
