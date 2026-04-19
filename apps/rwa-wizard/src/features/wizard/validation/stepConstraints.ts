/**
 * Shared validation constants for wizard fields.
 *
 * These are the single source of truth for UI-level bounds — every form field
 * and every step-level validator pulls from here, which prevents the form
 * error UI and the Next-button gating from drifting out of sync.
 *
 * The corresponding generator-level constants (e.g. Stellar's
 * `STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH`) live in the codegen
 * packages and may be stricter than these UI limits; the UI intentionally
 * enforces the tightest known bound for a smoother authoring experience.
 */

export const TOKEN_NAME_MAX_LENGTH = 32;
export const TOKEN_SYMBOL_MAX_LENGTH = 12;
export const TOKEN_DECIMALS_MIN = 0;
export const TOKEN_DECIMALS_MAX = 18;
