'use strict';

/**
 * Flat-config plugin carrying the provenance guard. Registered in
 * `eslint.config.cjs` for every codegen package's `src/`, and loaded by the
 * same `require` from `codegen-core`'s vitest suite so `pnpm lint` and the
 * package tests run one implementation.
 */
const noEarlyConfigRead = require('./rules/no-early-config-read.cjs');

module.exports = {
  meta: { name: 'eslint-plugin-provenance', version: '0.1.0' },
  rules: { 'no-early-config-read': noEarlyConfigRead },
};
