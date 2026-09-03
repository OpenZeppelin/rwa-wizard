import { describe, expect, it } from 'vitest';

import { completeDraft } from '../../test/helpers/previewConfig';
import {
  CodegenGenerationError,
  CodegenInvalidConfigError,
  CodegenUnsupportedError,
  toCodegenError,
} from './errors';
import { createTestCodegenService } from './testCodegenService';

describe('toCodegenError (INV-8, INV-21)', () => {
  it('wraps Invalid configuration: messages as CodegenInvalidConfigError (INV-8)', () => {
    const thrown = new Error('Invalid configuration: token.name required');
    expect(() => toCodegenError(thrown)).toThrow(CodegenInvalidConfigError);
    try {
      toCodegenError(thrown);
    } catch (err) {
      expect(err).toBeInstanceOf(CodegenInvalidConfigError);
      if (err instanceof CodegenInvalidConfigError) {
        expect(err.code).toBe('CODEGEN_INVALID_CONFIG');
        expect(err.errors).toEqual([
          { field: '', code: 'INVALID_CONFIG', message: thrown.message },
        ]);
      }
    }
  });

  it('wraps other Errors as CodegenGenerationError (INV-8)', () => {
    const thrown = new Error('boom');
    try {
      toCodegenError(thrown);
      expect.fail('INV-8: expected CodegenGenerationError');
    } catch (err) {
      expect(err).toBeInstanceOf(CodegenGenerationError);
      if (err instanceof CodegenGenerationError) {
        expect(err.code).toBe('CODEGEN_GENERATION_FAILED');
        expect(err.message).toBe('boom');
        expect(err.cause).toBe(thrown);
      }
    }
  });

  it('wraps non-Error throws as CodegenGenerationError (INV-8)', () => {
    try {
      toCodegenError('not-an-error');
      expect.fail('INV-8: expected CodegenGenerationError');
    } catch (err) {
      expect(err).toBeInstanceOf(CodegenGenerationError);
      if (err instanceof CodegenGenerationError) {
        expect(err.code).toBe('CODEGEN_GENERATION_FAILED');
        expect(err.message).toBe('not-an-error');
      }
    }
  });

  it('rethrows an already-typed CodegenInvalidConfigError as the same instance (INV-8)', () => {
    const typed = new CodegenInvalidConfigError([
      { field: 'token.name', code: 'REQUIRED_FIELD', message: 'required' },
    ]);
    try {
      toCodegenError(typed);
      expect.fail('INV-8: expected rethrow');
    } catch (err) {
      expect(err).toBe(typed);
      expect(err).toBeInstanceOf(CodegenInvalidConfigError);
    }
  });

  it('rethrows CodegenGenerationError and CodegenUnsupportedError as-is (INV-8)', () => {
    const generation = new CodegenGenerationError('failed');
    const unsupported = new CodegenUnsupportedError('stellar');
    try {
      toCodegenError(generation);
      expect.fail('INV-8: expected rethrow of CodegenGenerationError');
    } catch (err) {
      expect(err).toBe(generation);
    }
    try {
      toCodegenError(unsupported);
      expect.fail('INV-8: expected rethrow of CodegenUnsupportedError');
    } catch (err) {
      expect(err).toBe(unsupported);
      if (err instanceof CodegenUnsupportedError) {
        expect(err.code).toBe('CODEGEN_GENERATE_UNSUPPORTED');
        expect(err.targetId).toBe('stellar');
      }
    }
  });

  it('does not attach the input config onto typed errors (INV-21)', () => {
    const config = completeDraft();
    try {
      toCodegenError(new Error('boom'));
      expect.fail('INV-21: expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CodegenGenerationError);
      expect(Object.prototype.hasOwnProperty.call(err, 'config')).toBe(false);
      expect(JSON.stringify(err)).not.toContain(JSON.stringify(config));
      if (err instanceof CodegenGenerationError) {
        expect(err.message).toBe('boom');
      }
    }
  });
});

describe('createTestCodegenService generateFileTree (INV-10, INV-16, INV-22)', () => {
  it('resolves a README.md whose text matches the dummy ZIP payload (INV-22)', async () => {
    const service = createTestCodegenService();
    const config = completeDraft();
    const tree = await service.generateFileTree(config);
    const zip = await service.generateZip(config);

    expect(tree.files['README.md']).toBe(`# Test RWA project for ${config.token.name}\n`);
    expect(await zip.data.text()).toBe(tree.files['README.md']);
  });

  it('returns injected kinds and unknown otherwise, with no stellar path table (INV-10)', () => {
    const service = createTestCodegenService({
      fileKinds: { 'a/b.rs': 'contract' },
    });

    expect(service.getGeneratedFileKind?.('a/b.rs')).toBe('contract');
    expect(service.getGeneratedFileKind?.('other')).toBe('unknown');
  });

  it('defaults every path to unknown when fileKinds is omitted (INV-10)', () => {
    const service = createTestCodegenService();
    expect(service.getGeneratedFileKind?.('a/b.rs')).toBe('unknown');
    expect(service.getGeneratedFileKind?.('README.md')).toBe('unknown');
  });

  it('does not emit a packaging onStatus event (INV-16)', async () => {
    const service = createTestCodegenService();
    const phases: string[] = [];
    await service.generateFileTree(completeDraft(), {
      onStatus: (status) => phases.push(status.phase),
    });
    expect(phases, 'INV-16: test double must not fake packaging for preview').toEqual([]);
  });

  it('throws CodegenInvalidConfigError when failGenerateFileTree is set (INV-10)', async () => {
    const service = createTestCodegenService({ failGenerateFileTree: true });
    await expect(service.generateFileTree(completeDraft())).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(CodegenInvalidConfigError);
      if (err instanceof CodegenInvalidConfigError) {
        expect(err.code).toBe('CODEGEN_INVALID_CONFIG');
      }
      return true;
    });
  });
});
