import { describe, expect, it } from 'vitest';

import type { ValidationError, ValidationWarning } from '../src/types';
import { composeValidationRules, createValidationRule, validateWithRules } from '../src/validation';

describe('Validation Framework', () => {
  describe('createValidationRule', () => {
    it('should create a rule that returns errors', () => {
      const rule = createValidationRule<{ name: string }>((config) => {
        const errors: ValidationError[] = [];
        if (!config.name) {
          errors.push({
            field: 'name',
            code: 'REQUIRED_FIELD',
            message: 'Name is required',
          });
        }
        return { errors, warnings: [] };
      });

      const result = rule({ name: '' });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('REQUIRED_FIELD');
      expect(result.errors[0].field).toBe('name');
    });

    it('should create a rule that returns warnings', () => {
      const rule = createValidationRule<{ value: number }>((config) => {
        const warnings: ValidationWarning[] = [];
        if (config.value > 100) {
          warnings.push({
            field: 'value',
            code: 'VALUE_HIGH',
            message: 'Value is unusually high',
          });
        }
        return { errors: [], warnings };
      });

      const result = rule({ value: 200 });
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('VALUE_HIGH');
    });

    it('should return empty arrays for a passing rule', () => {
      const rule = createValidationRule<{ name: string }>(() => ({
        errors: [],
        warnings: [],
      }));

      const result = rule({ name: 'valid' });
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('composeValidationRules', () => {
    it('should aggregate errors from multiple rules', () => {
      const rule1 = createValidationRule<{ a: string; b: string }>((config) => ({
        errors: config.a ? [] : [{ field: 'a', code: 'REQUIRED_FIELD', message: 'A is required' }],
        warnings: [],
      }));

      const rule2 = createValidationRule<{ a: string; b: string }>((config) => ({
        errors: config.b ? [] : [{ field: 'b', code: 'REQUIRED_FIELD', message: 'B is required' }],
        warnings: [],
      }));

      const composed = composeValidationRules(rule1, rule2);
      const result = composed({ a: '', b: '' });

      expect(result.errors).toHaveLength(2);
      expect(result.errors.map((e) => e.field)).toEqual(['a', 'b']);
    });

    it('should aggregate errors and warnings separately', () => {
      const errorRule = createValidationRule<{ val: number }>(() => ({
        errors: [{ field: 'val', code: 'INVALID_RANGE', message: 'Out of range' }],
        warnings: [],
      }));

      const warningRule = createValidationRule<{ val: number }>(() => ({
        errors: [],
        warnings: [{ field: 'val', code: 'VALUE_HIGH', message: 'Unusually high' }],
      }));

      const composed = composeValidationRules(errorRule, warningRule);
      const result = composed({ val: 999 });

      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
    });

    it('should return empty results when all rules pass', () => {
      const rule1 = createValidationRule<unknown>(() => ({ errors: [], warnings: [] }));
      const rule2 = createValidationRule<unknown>(() => ({ errors: [], warnings: [] }));

      const composed = composeValidationRules(rule1, rule2);
      const result = composed({});

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('validateWithRules', () => {
    it('should return valid: true when no errors', () => {
      const rule = createValidationRule<unknown>(() => ({
        errors: [],
        warnings: [],
      }));

      const result = validateWithRules({}, [rule]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return valid: false when there are errors', () => {
      const rule = createValidationRule<unknown>(() => ({
        errors: [{ field: 'x', code: 'INVALID', message: 'Invalid' }],
        warnings: [],
      }));

      const result = validateWithRules({}, [rule]);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should return valid: true with warnings but no errors', () => {
      const rule = createValidationRule<unknown>(() => ({
        errors: [],
        warnings: [{ field: 'x', code: 'WARN', message: 'Warning' }],
      }));

      const result = validateWithRules({}, [rule]);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });

    it('should support field paths with dot notation and array indices', () => {
      const rule = createValidationRule<unknown>(() => ({
        errors: [
          { field: 'token.decimals', code: 'INVALID_RANGE', message: 'Out of range' },
          {
            field: 'compliance.modules[0].moduleId',
            code: 'UNSUPPORTED_MODULE',
            message: 'Module not found',
          },
        ],
        warnings: [],
      }));

      const result = validateWithRules({}, [rule]);
      expect(result.errors[0].field).toBe('token.decimals');
      expect(result.errors[1].field).toBe('compliance.modules[0].moduleId');
    });

    it('should use uppercase snake_case error codes', () => {
      const rule = createValidationRule<unknown>(() => ({
        errors: [
          { field: 'a', code: 'REQUIRED_FIELD', message: 'Required' },
          { field: 'b', code: 'INVALID_RANGE', message: 'Range' },
          { field: 'c', code: 'DUPLICATE_ENTRY', message: 'Dup' },
          { field: 'd', code: 'UNSUPPORTED_MODULE', message: 'Unsup' },
        ],
        warnings: [],
      }));

      const result = validateWithRules({}, [rule]);
      for (const error of result.errors) {
        expect(error.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    });

    it('should aggregate from multiple rules', () => {
      const rules = [
        createValidationRule<unknown>(() => ({
          errors: [{ field: 'a', code: 'ERR_A', message: 'A error' }],
          warnings: [],
        })),
        createValidationRule<unknown>(() => ({
          errors: [],
          warnings: [{ field: 'b', code: 'WARN_B', message: 'B warning' }],
        })),
        createValidationRule<unknown>(() => ({
          errors: [{ field: 'c', code: 'ERR_C', message: 'C error' }],
          warnings: [{ field: 'd', code: 'WARN_D', message: 'D warning' }],
        })),
      ];

      const result = validateWithRules({}, rules);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.warnings).toHaveLength(2);
    });
  });
});
