import { describe, expect, it } from 'vitest';

import {
  createCustomDeploymentTarget,
  createPresetDeploymentTarget,
  createValidConfig,
} from './helpers/config';

import { generateRoleSymbol, STELLAR_VALIDATION_CONSTANTS } from '../src/constants';
import { StellarRwaGenerator } from '../src/stellar-rwa-generator';

const I128_MAX = '170141183460469231731687303715884105727';
const I128_OVERFLOW = '170141183460469231731687303715884105728';

describe('RWA Config Validation (US5)', () => {
  const generator = new StellarRwaGenerator();

  describe('valid config passes', () => {
    it('should return valid: true for a complete, valid config', () => {
      const config = createValidConfig();
      const result = generator.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with initialSupply at i128 max boundary', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: I128_MAX,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with initialSupply "0"', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: '0',
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn that initial supply requires manual verified minting', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: '1000000',
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'token.initialSupply',
          code: 'MANUAL_VERIFIED_MINT_REQUIRED',
        })
      );
    });

    it('should pass with initialSupply undefined (no initial mint)', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Token validation
  // -----------------------------------------------------------------------

  describe('token.name', () => {
    it('should error when name is empty', () => {
      const config = createValidConfig({
        token: {
          name: '',
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.name',
          code: 'REQUIRED_FIELD',
        })
      );
    });

    it('should error when name exceeds max length', () => {
      const config = createValidConfig({
        token: {
          name: 'A'.repeat(STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH + 1),
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.name',
          code: 'MAX_LENGTH_EXCEEDED',
        })
      );
    });

    it('should error when name contains control characters', () => {
      const config = createValidConfig({
        token: {
          name: 'Bad\nName',
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.name',
          code: 'INVALID_CONTROL_CHARACTERS',
        })
      );
    });

    it('should check UTF-8 byte length for Unicode token name', () => {
      // Each emoji is 4 bytes in UTF-8. 9 emojis = 36 bytes > 32 max.
      const unicodeName = '🏠'.repeat(9);
      expect(unicodeName.length).toBeLessThanOrEqual(32);
      expect(new TextEncoder().encode(unicodeName).length).toBeGreaterThan(32);

      const config = createValidConfig({
        token: {
          name: unicodeName,
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.name',
          code: 'MAX_LENGTH_EXCEEDED',
        })
      );
    });
  });

  describe('token.symbol', () => {
    it('should error when symbol is empty', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: '',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.symbol',
          code: 'REQUIRED_FIELD',
        })
      );
    });

    it('should error when symbol exceeds 12 chars', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'A'.repeat(STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH + 1),
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.symbol',
          code: 'MAX_LENGTH_EXCEEDED',
        })
      );
    });

    it('should error when symbol sanitizes to an empty directory name base', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: '!!!',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.symbol',
          code: 'INVALID_TOKEN_SYMBOL',
        })
      );
    });

    it('should error when symbol contains control characters', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TS\nT',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.symbol',
          code: 'INVALID_CONTROL_CHARACTERS',
        })
      );
    });

    it('should pass with symbol at exactly 12 chars', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'A'.repeat(STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH),
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('token.decimals', () => {
    it('should error when decimals is below minimum', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: -1,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.decimals',
          code: 'INVALID_RANGE',
        })
      );
    });

    it('should error when decimals exceeds maximum', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 19,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.decimals',
          code: 'INVALID_RANGE',
        })
      );
    });

    it('should error when decimals is not an integer', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 7.5,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.decimals',
          code: 'INVALID_RANGE',
        })
      );
    });

    it('should pass at boundary values 0 and 18', () => {
      for (const decimals of [0, 18]) {
        const config = createValidConfig({
          token: {
            name: 'Test',
            symbol: 'TST',
            decimals,
            documentManager: { enabled: false },
          },
        });

        const result = generator.validate(config);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('token.initialSupply', () => {
    it('should error when initialSupply exceeds i128 max', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: I128_OVERFLOW,
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.initialSupply',
          code: 'I128_OVERFLOW',
        })
      );
    });

    it('should error when initialSupply is negative', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: '-1',
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.initialSupply',
          code: 'INVALID_RANGE',
        })
      );
    });

    it('should error when initialSupply is not a valid numeric string', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: 'abc',
          documentManager: { enabled: false },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'token.initialSupply',
          code: 'INVALID_FORMAT',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Identity verification validation
  // -----------------------------------------------------------------------

  describe('identityVerification.claimTopics', () => {
    it('should error on duplicate claimTopic IDs', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [
            { id: 1, name: 'KYC' },
            { id: 1, name: 'KYC Duplicate' },
          ],
          trustedIssuers: [],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'identityVerification.claimTopics',
          code: 'DUPLICATE_ENTRY',
        })
      );
    });

    it('should pass with zero claimTopics and zero trustedIssuers', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [],
          trustedIssuers: [],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('identityVerification.trustedIssuers', () => {
    it('should error when trustedIssuer references non-existent claimTopic', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [{ id: 1, name: 'KYC' }],
          trustedIssuers: [
            {
              address: 'GCEXAMPLEISSUER',
              claimTopics: [1, 99],
            },
          ],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'identityVerification.trustedIssuers[0].claimTopics',
          code: 'INVALID_REFERENCE',
        })
      );
    });

    it('should error when trustedIssuer address is empty', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [{ id: 1, name: 'KYC' }],
          trustedIssuers: [
            {
              address: '',
              claimTopics: [1],
            },
          ],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'identityVerification.trustedIssuers[0].address',
          code: 'REQUIRED_FIELD',
        })
      );
    });

    it('should error when trustedIssuer has empty claimTopics array', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [{ id: 1, name: 'KYC' }],
          trustedIssuers: [
            {
              address: 'GCEXAMPLEISSUER',
              claimTopics: [],
            },
          ],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'identityVerification.trustedIssuers[0].claimTopics',
          code: 'REQUIRED_FIELD',
        })
      );
    });

    /**
     * SF-16 INV-36 fixture 2 — an issuer whose every referenced topic is
     * unselected.
     *
     * It lives here rather than in `GOLDEN_FIXTURES` because it PROVABLY cannot
     * be a golden fixture: it is invalid by the rule this sub-feature adds, so
     * `golden-matrix-rule.test.ts`'s "every fixture passes validation" fails by
     * name — and worse, `generate()` throws on an invalid config, so every suite
     * that maps `GOLDEN_FIXTURES` through `generate` at module scope would die at
     * collection.
     */
    const issuerAllTopicsUnselectedConfig = () =>
      createValidConfig({
        identityVerification: {
          claimTopics: [
            { id: 1, name: 'KYC', selected: false },
            { id: 2, name: 'AML', selected: false },
          ],
          trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] }],
        },
      });

    /**
     * INV-8 — seven branch / boundary cases, one test each.
     *
     * `REQUIRED_FIELD` / `INVALID_REFERENCE` / `UNSELECTED_REFERENCE` are
     * branches of one `if / else if / else if`, never independent checks. A
     * suite that spot-checks the new branch alone cannot tell a branch from an
     * extra check that fires beside `INVALID_REFERENCE`.
     */
    const BRANCH_CASES = [
      {
        label: '1 — no topics named → REQUIRED_FIELD',
        config: () =>
          createValidConfig({
            identityVerification: {
              claimTopics: [{ id: 1, name: 'KYC' }],
              trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [] }],
            },
          }),
        code: 'REQUIRED_FIELD' as const,
        valid: false,
      },
      {
        label: '2 — one named topic that does not exist → INVALID_REFERENCE',
        config: () =>
          createValidConfig({
            identityVerification: {
              claimTopics: [{ id: 1, name: 'KYC' }],
              trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [99] }],
            },
          }),
        code: 'INVALID_REFERENCE' as const,
        valid: false,
      },
      {
        label: '3 — one named topic that exists and is selected → valid',
        config: () =>
          createValidConfig({
            identityVerification: {
              claimTopics: [{ id: 1, name: 'KYC' }],
              trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1] }],
            },
          }),
        code: null,
        valid: true,
      },
      {
        label: '4 — one named topic that exists and is unselected → UNSELECTED_REFERENCE',
        config: () =>
          createValidConfig({
            identityVerification: {
              claimTopics: [{ id: 1, name: 'KYC', selected: false }],
              trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1] }],
            },
          }),
        code: 'UNSELECTED_REFERENCE' as const,
        valid: false,
      },
      {
        label: '5 — two named topics, one selected → valid',
        config: () =>
          createValidConfig({
            identityVerification: {
              claimTopics: [
                { id: 1, name: 'KYC', selected: false },
                { id: 2, name: 'AML' },
              ],
              trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] }],
            },
          }),
        code: null,
        valid: true,
      },
      {
        label: '6 — two named topics, both unselected → UNSELECTED_REFERENCE',
        config: issuerAllTopicsUnselectedConfig,
        code: 'UNSELECTED_REFERENCE' as const,
        valid: false,
      },
      {
        label:
          '7 — nonexistent AND unselected together → INVALID_REFERENCE wins; UNSELECTED_REFERENCE does not also fire',
        config: () =>
          createValidConfig({
            identityVerification: {
              claimTopics: [
                { id: 1, name: 'KYC', selected: false },
                { id: 2, name: 'AML' },
              ],
              trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1, 99] }],
            },
          }),
        code: 'INVALID_REFERENCE' as const,
        valid: false,
      },
    ] as const;

    it('INV-8 enumerates seven branch cases, and the count is asserted so a trim is visible', () => {
      expect(BRANCH_CASES).toHaveLength(7);
    });

    it.each(BRANCH_CASES)('INV-8 $label', (branch) => {
      const result = generator.validate(branch.config());
      expect(result.valid).toBe(branch.valid);

      const onTopics = result.errors.filter(
        (error) => error.field === 'identityVerification.trustedIssuers[0].claimTopics'
      );

      if (branch.code === null) {
        expect(onTopics).toEqual([]);
        return;
      }

      expect(onTopics).toHaveLength(1);
      expect(onTopics[0]?.code).toBe(branch.code);
      // Branch 7's load-bearing half: INVALID_REFERENCE wins and the new code
      // does not also fire. Asserted on every erroring row so an independent
      // second check cannot hide behind the happy-path cases.
      expect(onTopics.map((error) => error.code)).toEqual([branch.code]);
    });

    it('should error with UNSELECTED_REFERENCE when every referenced topic is unselected', () => {
      const result = generator.validate(issuerAllTopicsUnselectedConfig());

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'identityVerification.trustedIssuers[0].claimTopics',
          code: 'UNSELECTED_REFERENCE',
        })
      );
    });

    it('should not double-report: UNSELECTED_REFERENCE is a branch, not an extra check', () => {
      // One issuer, one problem, one error. `REQUIRED_FIELD`,
      // `INVALID_REFERENCE` and `UNSELECTED_REFERENCE` are branches of one
      // `if / else if / else if` chain over the same field.
      const result = generator.validate(issuerAllTopicsUnselectedConfig());
      const onTopics = result.errors.filter(
        (error) => error.field === 'identityVerification.trustedIssuers[0].claimTopics'
      );

      expect(onTopics).toHaveLength(1);
    });

    it('stays valid when the issuer still references one selected topic', () => {
      // Unselection must never invalidate a draft that was valid — that is what
      // makes it non-destructive rather than merely reversible.
      const result = generator.validate(
        createValidConfig({
          identityVerification: {
            claimTopics: [
              { id: 1, name: 'KYC', selected: false },
              { id: 2, name: 'AML' },
            ],
            trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] }],
          },
        })
      );

      expect(result.valid).toBe(true);
    });

    it('resolves references against DEFINED topics, so unselection is never INVALID_REFERENCE', () => {
      const result = generator.validate(issuerAllTopicsUnselectedConfig());

      expect(result.errors.map((error) => error.code)).not.toContain('INVALID_REFERENCE');
    });
  });

  // -----------------------------------------------------------------------
  // Access control validation
  // -----------------------------------------------------------------------

  describe('accessControl.ownership', () => {
    it('should error when owner address is empty (single-owner)', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: '' },
          roles: [],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'accessControl.ownership.ownerAddress',
          code: 'REQUIRED_FIELD',
        })
      );
    });

    it('should error when address is empty (multi-sig)', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'multi-sig', address: '' },
          roles: [],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'accessControl.ownership.address',
          code: 'REQUIRED_FIELD',
        })
      );
    });

    it('should error when address is empty (dao)', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'dao', address: '' },
          roles: [],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'accessControl.ownership.address',
          code: 'REQUIRED_FIELD',
        })
      );
    });
  });

  describe('accessControl.roles', () => {
    it('should error when role name is empty', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
          roles: [{ name: '', symbol: 'mgr', addresses: ['GCADDR'] }],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'accessControl.roles[0].name',
          code: 'REQUIRED_FIELD',
        })
      );
    });

    it('should error when explicit role symbol exceeds 9 chars', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
          roles: [{ name: 'Manager', symbol: 'toolongsym', addresses: ['GCADDR'] }],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'accessControl.roles[0].symbol',
          code: 'MAX_LENGTH_EXCEEDED',
        })
      );
    });

    it('should error on duplicate role symbols (explicit)', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
          roles: [
            { name: 'Manager', symbol: 'mgr', addresses: ['GCADDR1'] },
            { name: 'Operator', symbol: 'mgr', addresses: ['GCADDR2'] },
          ],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'accessControl.roles',
          code: 'DUPLICATE_ENTRY',
        })
      );
    });

    it('should error on duplicate role symbols (auto-generated collision)', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
          roles: [
            { name: 'manager', addresses: ['GCADDR1'] },
            { name: 'Manager', addresses: ['GCADDR2'] },
          ],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'accessControl.roles',
          code: 'DUPLICATE_ENTRY',
        })
      );
    });

    it('should pass with empty roles array (admin-only)', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
          roles: [],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
    });

    it('should auto-generate role symbol when omitted', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
          roles: [
            { name: 'Manager', addresses: ['GCADDR1'] },
            { name: 'Agent', addresses: ['GCADDR2'] },
          ],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);

      expect(generateRoleSymbol('Manager')).toBe('manager');
      expect(generateRoleSymbol('Agent')).toBe('agent');
    });

    it('should pass when all operators have the same address', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
          roles: [
            { name: 'Manager', symbol: 'manager', addresses: ['GCSAMEADDR'] },
            { name: 'Agent', symbol: 'agent', addresses: ['GCSAMEADDR'] },
          ],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Deployment validation
  // -----------------------------------------------------------------------

  describe('deployment', () => {
    it('should error when preset networkId is empty', () => {
      const config = createValidConfig({
        deployment: { target: createPresetDeploymentTarget('') },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'deployment.target.networkId',
          code: 'REQUIRED_FIELD',
        })
      );
    });

    it('should error on unsupported preset networkId', () => {
      const config = createValidConfig({
        deployment: { target: createPresetDeploymentTarget('stellar-future') },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'deployment.target.networkId',
          code: 'UNSUPPORTED_NETWORK',
        })
      );
    });

    it('should error on unsupported ecosystem', () => {
      const config = createValidConfig({
        deployment: {
          target: {
            kind: 'preset',
            ecosystem: 'evm',
            networkId: 'stellar-testnet',
          },
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'deployment.target.ecosystem',
          code: 'UNSUPPORTED_ECOSYSTEM',
        })
      );
    });

    it('should pass with a supported preset target', () => {
      const config = createValidConfig({
        deployment: { target: createPresetDeploymentTarget('stellar-public') },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
    });

    it('should pass with a custom rpc target', () => {
      const config = createValidConfig({
        deployment: {
          target: createCustomDeploymentTarget('https://custom-rpc.example.com'),
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
    });

    it('should error when custom rpcUrl contains control characters', () => {
      const config = createValidConfig({
        deployment: {
          target: createCustomDeploymentTarget('https://evil.example.com\n'),
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'deployment.target.rpcUrl',
          code: 'INVALID_CONTROL_CHARACTERS',
        })
      );
    });

    it('should error when custom label contains control characters', () => {
      const config = createValidConfig({
        deployment: {
          target: createCustomDeploymentTarget('https://custom-rpc.example.com', {
            label: 'My\nnet',
          }),
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'deployment.target.label',
          code: 'INVALID_CONTROL_CHARACTERS',
        })
      );
    });

    it('should error when custom explorerUrl is invalid', () => {
      const config = createValidConfig({
        deployment: {
          target: createCustomDeploymentTarget('https://custom-rpc.example.com', {
            explorerUrl: 'not-a-valid-url',
          }),
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'deployment.target.explorerUrl',
          code: 'INVALID_FORMAT',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Compliance module validation
  // -----------------------------------------------------------------------

  describe('compliance.modules', () => {
    it('should error on unsupported compliance module', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'nonexistent-module' }],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'compliance.modules[0].moduleId',
          code: 'UNSUPPORTED_MODULE',
        })
      );
    });

    it('should error when a numeric module config field has the wrong type', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: '1000000' } }],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'compliance.modules[0].config.limit',
          code: 'INVALID_MODULE_CONFIG_TYPE',
        })
      );
    });

    it('should error when a string-array module config field has the wrong type', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'country-allow', config: { allowedCountries: 123 } }],
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'compliance.modules[0].config.allowedCountries',
          code: 'INVALID_MODULE_CONFIG_TYPE',
        })
      );
    });

    it('should allow comma-delimited strings for string-array module config fields', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'country-allow', config: { allowedCountries: 'CH, SG' } }],
        },
      });

      const result = generator.validate(config, { allowUnderReviewModules: true });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('should silently ignore extra/unknown config properties', () => {
      const config = createValidConfig();
      (config as unknown as Record<string, unknown>).unknownProperty = 'should be ignored';
      (config.token as unknown as Record<string, unknown>).extraField = 42;

      const result = generator.validate(config);
      expect(result.valid).toBe(true);
    });

    it('should accumulate multiple errors from different fields', () => {
      const config = createValidConfig({
        token: {
          name: '',
          symbol: '',
          decimals: -1,
          documentManager: { enabled: false },
        },
        deployment: {
          target: createCustomDeploymentTarget('', { explorerUrl: 'not-a-valid-url' }),
        },
      });

      const result = generator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });
  });

  // -----------------------------------------------------------------------
  // Integration: generate() throws on invalid config
  // -----------------------------------------------------------------------

  describe('generate() validation guard', () => {
    it('should throw when config is invalid', () => {
      const config = createValidConfig({
        token: {
          name: '',
          symbol: '',
          decimals: -1,
          documentManager: { enabled: false },
        },
      });

      expect(() => generator.generate(config)).toThrow('Invalid configuration');
    });

    it('should reject invalid module config types before deployment descriptors run', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: '1000000' } }],
        },
      });

      expect(() => generator.generate(config)).toThrow('Invalid configuration');
      expect(() => generator.generate(config)).not.toThrow(
        'Unsupported config value for supply-limit.limit'
      );
    });

    it('should not throw when config is valid', () => {
      const config = createValidConfig();

      expect(() => generator.generate(config)).not.toThrow();
    });
  });
});
