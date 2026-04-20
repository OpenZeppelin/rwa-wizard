import { describe, expect, it } from 'vitest';

import { extractFilesFromZip, findFileContent } from './utils/zip-inspector';

import { createFile, mergeFileTrees } from '../src/file-tree';
import { generateZip } from '../src/generator';
import type {
  GenerateOptions,
  GenerationMetadata,
  GenerationResult,
  Generator,
  ValidationResult,
} from '../src/types';
import { validateWithRules } from '../src/validation';
import type { ValidationRule } from '../src/validation';

// ---------------------------------------------------------------------------
// Dummy Generator — proves the core engine is chain-agnostic (SC-008)
// ---------------------------------------------------------------------------

interface DummyConfig {
  message: string;
}

function createDummyRules(): ValidationRule<DummyConfig>[] {
  return [
    (config: DummyConfig) => {
      if (!config.message || config.message.trim().length === 0) {
        return {
          errors: [
            {
              field: 'message',
              code: 'REQUIRED_FIELD',
              message: 'message must not be empty',
            },
          ],
          warnings: [],
        };
      }
      return { errors: [], warnings: [] };
    },
    (config: DummyConfig) => {
      const warnings =
        config.message.length > 50
          ? [
              {
                field: 'message',
                code: 'VALUE_TOO_LONG',
                message: 'message is unusually long',
              },
            ]
          : [];
      return { errors: [], warnings };
    },
  ];
}

class DummyGenerator implements Generator<DummyConfig> {
  readonly name = 'dummy-generator';
  readonly version = '0.1.0';

  validate(config: DummyConfig): ValidationResult {
    return validateWithRules(config, createDummyRules());
  }

  generate(config: DummyConfig, _options?: GenerateOptions): GenerationResult {
    const validation = this.validate(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const files = mergeFileTrees(
      createFile('greeting.txt', `Hello: ${config.message}`),
      createFile('meta.json', JSON.stringify({ source: config.message, generator: this.name }))
    );

    const metadata: GenerationMetadata = {
      generatorName: this.name,
      generatorVersion: this.version,
      generatedAt: new Date().toISOString(),
      fileCount: Object.keys(files).length,
      configHash: 'dummy-hash',
    };

    return { files, metadata };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Generator Extensibility (SC-008)', () => {
  const generator = new DummyGenerator();

  describe('Generator interface', () => {
    it('should expose name and version', () => {
      expect(generator.name).toBe('dummy-generator');
      expect(generator.version).toBe('0.1.0');
    });

    it('should implement Generator<DummyConfig> with no chain-specific assumptions', () => {
      const gen: Generator<DummyConfig> = generator;
      expect(gen.name).toBeDefined();
      expect(gen.version).toBeDefined();
      expect(typeof gen.validate).toBe('function');
      expect(typeof gen.generate).toBe('function');
    });
  });

  describe('validate()', () => {
    it('should pass validation for a valid config', () => {
      const result = generator.validate({ message: 'hello world' });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should fail validation for an empty message', () => {
      const result = generator.validate({ message: '' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('message');
      expect(result.errors[0].code).toBe('REQUIRED_FIELD');
    });

    it('should fail validation for a whitespace-only message', () => {
      const result = generator.validate({ message: '   ' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('REQUIRED_FIELD');
    });

    it('should return a warning for a long message without failing', () => {
      const longMessage = 'a'.repeat(60);
      const result = generator.validate({ message: longMessage });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('VALUE_TOO_LONG');
    });
  });

  describe('generate()', () => {
    it('should produce exactly 2 files', () => {
      const result = generator.generate({ message: 'test' });

      expect(Object.keys(result.files)).toHaveLength(2);
      expect(result.files['greeting.txt']).toBeDefined();
      expect(result.files['meta.json']).toBeDefined();
    });

    it('should embed the config message in generated files', () => {
      const result = generator.generate({ message: 'world' });

      expect(result.files['greeting.txt']).toBe('Hello: world');
      const meta = JSON.parse(result.files['meta.json'] as string);
      expect(meta.source).toBe('world');
      expect(meta.generator).toBe('dummy-generator');
    });

    it('should populate GenerationMetadata correctly', () => {
      const result = generator.generate({ message: 'test' });

      expect(result.metadata.generatorName).toBe('dummy-generator');
      expect(result.metadata.generatorVersion).toBe('0.1.0');
      expect(result.metadata.fileCount).toBe(2);
      expect(result.metadata.generatedAt).toBeTruthy();
      expect(result.metadata.configHash).toBeTruthy();
    });

    it('should throw on invalid config', () => {
      expect(() => generator.generate({ message: '' })).toThrow('Invalid config');
    });
  });

  describe('validate → generate → generateZip pipeline', () => {
    it('should flow through the full pipeline end-to-end', async () => {
      const config: DummyConfig = { message: 'pipeline test' };

      const validation = generator.validate(config);
      expect(validation.valid).toBe(true);

      const result = generator.generate(config);
      expect(result.files['greeting.txt']).toBe('Hello: pipeline test');

      const zip = await generateZip(result, 'dummy-output');
      expect(zip.data).toBeInstanceOf(Blob);
      expect(zip.data.size).toBeGreaterThan(0);
      expect(zip.fileName).toBe('dummy-output.zip');
      expect(zip.metadata.generatorName).toBe('dummy-generator');
    });

    it('should produce a ZIP with correct file contents', async () => {
      const result = generator.generate({ message: 'zip check' });
      const zip = await generateZip(result, 'dummy-zip');

      const entries = await extractFilesFromZip(zip.data);
      const paths = entries.map((e) => e.path);

      expect(paths).toContain('dummy-zip/greeting.txt');
      expect(paths).toContain('dummy-zip/meta.json');

      const greetingContent = findFileContent(entries, 'dummy-zip/greeting.txt');
      expect(greetingContent).toBe('Hello: zip check');
    });

    it('should reject the pipeline when validation fails', () => {
      const config: DummyConfig = { message: '' };

      const validation = generator.validate(config);
      expect(validation.valid).toBe(false);

      expect(() => generator.generate(config)).toThrow();
    });
  });
});

describe('Concurrent Invocation Safety (CR-009)', () => {
  it('should produce correct results when invoked concurrently with different configs', async () => {
    const configs: DummyConfig[] = [
      { message: 'alpha' },
      { message: 'bravo' },
      { message: 'charlie' },
      { message: 'delta' },
      { message: 'echo' },
    ];

    const results = await Promise.all(
      configs.map(async (config) => {
        const generator = new DummyGenerator();
        const validation = generator.validate(config);
        expect(validation.valid).toBe(true);

        const result = generator.generate(config);
        const zip = await generateZip(result, `output-${config.message}`);
        return { config, result, zip };
      })
    );

    for (const { config, result, zip } of results) {
      expect(result.files['greeting.txt']).toBe(`Hello: ${config.message}`);

      const meta = JSON.parse(result.files['meta.json'] as string);
      expect(meta.source).toBe(config.message);

      expect(zip.fileName).toBe(`output-${config.message}.zip`);
      expect(zip.data.size).toBeGreaterThan(0);

      const entries = await extractFilesFromZip(zip.data);
      const greetingContent = findFileContent(entries, `output-${config.message}/greeting.txt`);
      expect(greetingContent).toBe(`Hello: ${config.message}`);
    }
  });

  it('should not share mutable state between concurrent generator instances', async () => {
    const generatorA = new DummyGenerator();
    const generatorB = new DummyGenerator();

    const [resultA, resultB] = await Promise.all([
      Promise.resolve(generatorA.generate({ message: 'instance-A' })),
      Promise.resolve(generatorB.generate({ message: 'instance-B' })),
    ]);

    expect(resultA.files['greeting.txt']).toBe('Hello: instance-A');
    expect(resultB.files['greeting.txt']).toBe('Hello: instance-B');
    expect(resultA.files['greeting.txt']).not.toBe(resultB.files['greeting.txt']);
  });

  it('should handle concurrent validation without interference', async () => {
    const validConfig: DummyConfig = { message: 'valid' };
    const invalidConfig: DummyConfig = { message: '' };

    const [validResult, invalidResult] = await Promise.all([
      Promise.resolve(new DummyGenerator().validate(validConfig)),
      Promise.resolve(new DummyGenerator().validate(invalidConfig)),
    ]);

    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors).toHaveLength(1);
  });
});
