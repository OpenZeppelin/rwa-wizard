import type { ValidationError, ValidationResult, ValidationWarning } from './types';

/**
 * Result from a single validation rule evaluation.
 */
export interface ValidationRuleResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * A validation rule is a function that inspects a config and returns
 * any errors and warnings found.
 */
export type ValidationRule<TConfig = unknown> = (config: TConfig) => ValidationRuleResult;

/**
 * Create a typed validation rule from a function.
 */
export function createValidationRule<TConfig>(
  fn: (config: TConfig) => ValidationRuleResult
): ValidationRule<TConfig> {
  return fn;
}

/**
 * Compose multiple validation rules into a single rule
 * that aggregates all errors and warnings.
 */
export function composeValidationRules<TConfig>(
  ...rules: ValidationRule<TConfig>[]
): ValidationRule<TConfig> {
  return (config: TConfig): ValidationRuleResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const rule of rules) {
      const result = rule(config);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return { errors, warnings };
  };
}

/**
 * Run an array of validation rules against a config
 * and assemble a complete ValidationResult.
 */
export function validateWithRules<TConfig>(
  config: TConfig,
  rules: ValidationRule<TConfig>[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const rule of rules) {
    const result = rule(config);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
