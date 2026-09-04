import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CodeViewReveal } from '@openzeppelin/ui-components/code-view';
import * as codeViewModule from '@openzeppelin/ui-components/code-view';

import * as languageModule from '../languageForPath';
import { PreviewCodePane } from './PreviewCodePane';

const PATH = 'README.md';
const SOURCE = '# title\nline two\nline three\nline four\n';
const FILES: Record<string, string> = { [PATH]: SOURCE };
const REVEAL: CodeViewReveal = { startLine: 2, endLine: 3, id: 1 };

/** The kit scrolls via `scrollIntoView`; happy-dom may not implement it. */
let scrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollSpy = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollSpy,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function pane(reveal?: CodeViewReveal, files: Record<string, string> = FILES): HTMLElement {
  render(
    <PreviewCodePane
      files={files}
      selectedPath={PATH}
      sourceRevision={null}
      importLinks={null}
      reveal={reveal}
    />
  );
  return screen.getByLabelText(`${PATH} source code`);
}

describe('PreviewCodePane reveal passthrough (INV-2)', () => {
  it('hands the exact reveal object to CodeView — no clamp, no copy', () => {
    const codeViewSpy = vi.spyOn(codeViewModule, 'CodeView');
    const inverted: CodeViewReveal = { startLine: 9, endLine: 2, id: 'x' };

    pane(inverted);

    const lastProps = codeViewSpy.mock.calls[codeViewSpy.mock.calls.length - 1]?.[0];
    expect(
      lastProps?.reveal,
      'INV-2: the kit is the only validator; the wizard passes the value by reference'
    ).toBe(inverted);
  });

  it('absent reveal reaches CodeView as undefined', () => {
    const codeViewSpy = vi.spyOn(codeViewModule, 'CodeView');

    pane(undefined);

    expect(codeViewSpy).toHaveBeenCalled();
    expect(codeViewSpy.mock.calls[codeViewSpy.mock.calls.length - 1]?.[0].reveal).toBeUndefined();
  });
});

describe('PreviewCodePane with the real kit — the mark is kit paint (INV-2, INV-3)', () => {
  it('with no reveal there is no mark and no scroll, and the source is intact', () => {
    const region = pane(undefined);

    expect(region.querySelectorAll('mark')).toHaveLength(0);
    expect(region.querySelectorAll('[data-code-view-reveal]')).toHaveLength(0);
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(region.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      SOURCE.replace(/\s+/g, ' ').trim()
    );
  });

  it('with a reveal, every <mark> in the pane is the kit’s, and the kit scrolls exactly once', () => {
    const region = pane(REVEAL);

    const marks = Array.from(region.querySelectorAll('mark'));
    expect(marks.length, 'the kit paints the range').toBeGreaterThan(0);
    for (const mark of marks) {
      expect(
        mark.hasAttribute('data-code-view-reveal'),
        'INV-3: no wizard-owned highlight beside the kit mark'
      ).toBe(true);
    }
    expect(
      region.textContent?.replace(/\s+/g, ' ').trim(),
      'INV-2: the preview stays the generated file'
    ).toBe(SOURCE.replace(/\s+/g, ' ').trim());
    expect(
      scrollSpy,
      'INV-3: one scroll, issued by the kit; the wizard never touches the DOM'
    ).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.instances[0]).toBe(region.querySelector('[data-code-view-reveal]'));
  });

  it('an invalid range passed through paints nothing and throws nothing (INV-2, INV-17)', () => {
    const region = pane({ startLine: 40, endLine: 50, id: 2 });

    expect(region.querySelectorAll('[data-code-view-reveal]')).toHaveLength(0);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('adds no wizard element or text on top of the plain pane: the element delta is exactly the kit marks', () => {
    const { container: plain } = render(
      <PreviewCodePane files={FILES} selectedPath={PATH} sourceRevision={null} importLinks={null} />
    );
    const plainElements = plain.querySelectorAll('*').length;
    const plainText = plain.textContent;
    plain.remove();

    const { container: marked } = render(
      <PreviewCodePane
        files={FILES}
        selectedPath={PATH}
        sourceRevision={null}
        importLinks={null}
        reveal={REVEAL}
      />
    );
    const kitMarks = marked.querySelectorAll('[data-code-view-reveal]').length;

    expect(kitMarks).toBeGreaterThan(0);
    expect(
      marked.querySelectorAll('*').length - plainElements,
      'INV-3: the only new elements are the kit’s marks'
    ).toBe(kitMarks);
    expect(
      marked.textContent,
      'INV-3: no caption, no “Lines 2–3”, nothing user-visible added'
    ).toBe(plainText);
  });
});

describe('PreviewCodePane memo and the reveal prop (INV-13)', () => {
  it('a re-render with the same reveal identity does not re-render the pane; a new identity does', () => {
    const probe = vi.spyOn(languageModule, 'languageForPath');
    const { rerender } = render(
      <PreviewCodePane
        files={FILES}
        selectedPath={PATH}
        sourceRevision={null}
        importLinks={null}
        reveal={REVEAL}
      />
    );
    const afterMount = probe.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);

    rerender(
      <PreviewCodePane
        files={FILES}
        selectedPath={PATH}
        sourceRevision={null}
        importLinks={null}
        reveal={REVEAL}
      />
    );
    expect(probe.mock.calls.length, 'INV-13: identical reveal → memo skips').toBe(afterMount);

    rerender(
      <PreviewCodePane
        files={FILES}
        selectedPath={PATH}
        sourceRevision={null}
        importLinks={null}
        reveal={{ ...REVEAL }}
      />
    );
    expect(
      probe.mock.calls.length,
      'a fresh object with equal fields would defeat the memo — this is the cost the hook memo prevents'
    ).toBeGreaterThan(afterMount);
  });
});
