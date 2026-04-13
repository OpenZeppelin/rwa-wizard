import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadZip } from './downloadZip';

describe('downloadZip', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let appendedElements: Node[];
  let removedElements: Node[];

  beforeEach(() => {
    createObjectURLSpy = vi.fn().mockReturnValue('blob:http://localhost/fake-url');
    revokeObjectURLSpy = vi.fn();

    URL.createObjectURL = createObjectURLSpy;
    URL.revokeObjectURL = revokeObjectURLSpy;

    appendedElements = [];
    removedElements = [];

    clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    const originalAppendChild = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
      appendedElements.push(node);
      return originalAppendChild(node);
    });

    const originalRemoveChild = document.body.removeChild.bind(document.body);
    vi.spyOn(document.body, 'removeChild').mockImplementation(<T extends Node>(child: T): T => {
      removedElements.push(child);
      return originalRemoveChild(child);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a blob URL from the data', () => {
    const blob = new Blob(['test content'], { type: 'application/zip' });
    downloadZip('test.zip', blob);

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
  });

  it('creates an anchor element with correct attributes', () => {
    const blob = new Blob(['test'], { type: 'application/zip' });
    downloadZip('my-project.zip', blob);

    expect(appendedElements.length).toBeGreaterThan(0);
    const anchor = appendedElements[0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe('A');
    expect(anchor.href).toContain('blob:');
    expect(anchor.download).toBe('my-project.zip');
    expect(anchor.rel).toBe('noopener');
  });

  it('clicks the anchor to trigger download', () => {
    const blob = new Blob(['test'], { type: 'application/zip' });
    downloadZip('test.zip', blob);

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('removes the anchor from DOM after click', () => {
    const blob = new Blob(['test'], { type: 'application/zip' });
    downloadZip('test.zip', blob);

    expect(removedElements.length).toBeGreaterThan(0);
  });

  it('revokes the blob URL after download', () => {
    const blob = new Blob(['test'], { type: 'application/zip' });
    downloadZip('test.zip', blob);

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/fake-url');
  });

  it('revokes URL even if click throws', () => {
    clickSpy.mockImplementation(() => {
      throw new Error('click failed');
    });

    const blob = new Blob(['test'], { type: 'application/zip' });
    expect(() => downloadZip('test.zip', blob)).toThrow('click failed');
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/fake-url');
  });
});
