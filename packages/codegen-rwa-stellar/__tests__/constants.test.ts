import { describe, expect, it } from 'vitest';

import { generateRoleSymbol, STELLAR_VALIDATION_CONSTANTS } from '../src/constants';

describe('STELLAR_VALIDATION_CONSTANTS', () => {
  it('should have correct token name max length', () => {
    expect(STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH).toBe(32);
  });

  it('should have correct token symbol max length', () => {
    expect(STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH).toBe(12);
  });

  it('should have correct decimals range', () => {
    expect(STELLAR_VALIDATION_CONSTANTS.DECIMALS_MIN).toBe(0);
    expect(STELLAR_VALIDATION_CONSTANTS.DECIMALS_MAX).toBe(18);
  });

  it('should have correct role symbol max length for Soroban symbol_short!', () => {
    expect(STELLAR_VALIDATION_CONSTANTS.ROLE_SYMBOL_MAX_LENGTH).toBe(9);
  });
});

describe('generateRoleSymbol', () => {
  it('should return known default for "Manager"', () => {
    expect(generateRoleSymbol('Manager')).toBe('manager');
  });

  it('should return known default for "agent"', () => {
    expect(generateRoleSymbol('agent')).toBe('agent');
  });

  it('should return known default for "Operator"', () => {
    expect(generateRoleSymbol('Operator')).toBe('operator');
  });

  it('should auto-generate from custom name by lowercasing', () => {
    expect(generateRoleSymbol('Auditor')).toBe('auditor');
  });

  it('should remove non-alphanumeric characters', () => {
    expect(generateRoleSymbol('Compliance Officer')).toBe('complianc');
  });

  it('should truncate to 9 chars (Soroban symbol_short! limit)', () => {
    expect(generateRoleSymbol('SuperLongRoleName')).toBe('superlong');
  });

  it('should handle single character names', () => {
    expect(generateRoleSymbol('X')).toBe('x');
  });

  it('should handle names with special characters', () => {
    expect(generateRoleSymbol('role-admin_v2')).toBe('roleadmin');
  });
});
