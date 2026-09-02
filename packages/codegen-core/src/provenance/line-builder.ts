/**
 * The push-and-join emission idiom with line attribution.
 *
 * `text()` is `elements.join(separator)` — the builder adds attribution to
 * bytes it never touches. Every range is computed from the running newline
 * count of the text the builder will produce, then trimmed by the one rule in
 * `line-ranges`; nothing is ever re-found by searching the output.
 */
import { bindScope } from './builder-registry';
import { ProvenanceAttributionError } from './errors';
import { countNewlines, trimToAttributedLines } from './line-ranges';
import type { ProvenanceScope } from './provenance-collector';
import type { ConfigPath, Observed } from './types';

/**
 * The emission surface a helper accepts without knowing the config type.
 *
 * Every method attributes what it emits to the paths read since the previous
 * emission, plus paths left pending by zero-line emissions and `observe`, plus
 * `extraPaths` — and records a range only when that union is non-empty.
 *
 * Methods return `void`: an emission is a statement, never an expression.
 */
export interface EmitOptions {
  /**
   * `true` marks EVERY path this emission attributes as secondary — the paths
   * drained since the previous emission, the pending window, and `extraPaths`.
   *
   * The mark applies to this call only: it is never pending and never drained,
   * so a zero-line emission discards it (a zero-line emission has no range, so
   * it has nothing to be secondary about). Nothing but the literal `true` marks.
   */
  readonly secondary?: boolean;
}

export interface LineSink {
  /** One element. `text` may contain `'\n'`; it then occupies several lines. */
  line(text: string, extraPaths?: readonly ConfigPath[], options?: EmitOptions): void;
  /** Several elements, attributed as ONE range covering all of them. `[]` emits nothing and leaves paths pending. */
  lines(texts: readonly string[], extraPaths?: readonly ConfigPath[], options?: EmitOptions): void;
  /** A multi-line string pushed as one element. `line` with a name that says what it is. */
  block(text: string, extraPaths?: readonly ConfigPath[], options?: EmitOptions): void;
}

export interface LineBuilder<T extends object> extends LineSink {
  /** The scope's recording view of the config — the only handle a template needs. */
  readonly config: T;
  /**
   * Compute a value used across emissions and get its paths back WITHOUT
   * attributing them here. Pass `.paths` to every emission the value shapes.
   */
  observe<R>(compute: (config: T) => R): Observed<R>;
  /** The number of lines `text()` would have now: `0` before the first emission. */
  readonly lineCount: number;
  /**
   * `elements.join(separator)`. Idempotent, and seals the builder: a later
   * emission would describe lines the returned text does not have.
   */
  text(): string;
}

export interface LineBuilderOptions {
  /** Joined between elements exactly as `Array.prototype.join`. Default `'\n'`. */
  readonly separator?: string;
}

/**
 * Bind a line builder to one scope. It MUST be the first thing that touches the
 * scope: the constructor drains it and refuses to build when anything was read
 * before, because those reads would silently land on whatever it emits first.
 */
export function createLineBuilder<T extends object>(
  scope: ProvenanceScope<T>,
  options?: LineBuilderOptions
): LineBuilder<T> {
  const separator = options?.separator ?? '\n';
  const separatorNewlines = countNewlines(separator);
  const cursor = bindScope(scope);

  const elements: string[] = [];
  let newlines = 0;
  let sealed = false;
  let output: string | undefined;

  const assertUnsealed = (): void => {
    if (sealed) throw new ProvenanceAttributionError('emit-after-text', scope.filePath); // INV-12
  };

  const emit = (
    chunk: readonly string[],
    extraPaths?: readonly ConfigPath[],
    options?: EmitOptions
  ): void => {
    assertUnsealed();
    if (chunk.length === 0) {
      // INV-22: a zero-line emission shapes what comes next.
      // INV-20: `options` is deliberately DROPPED. Paths stay pending; the mark
      // does not. Letting it survive to the next emission is the sticky-cursor
      // mechanism this design exists to make unreachable.
      cursor.flush(extraPaths);
      return;
    }
    const joined = chunk.join(separator);
    // INV-3: the first line of the region this emission will occupy.
    const startLine = newlines + (elements.length === 0 ? 0 : separatorNewlines) + 1;
    const range = trimToAttributedLines(joined, startLine); // INV-4
    const paths = cursor.take(extraPaths); // INV-5
    if (elements.length > 0) newlines += separatorNewlines;
    newlines += countNewlines(joined);
    elements.push(...chunk);
    // INV-22: recorded after the bytes exist in the builder, and only when the union is non-empty.
    // INV-19: the range, the path union and the mark are three values in one call
    // frame consumed by one `addRange` — the site marked IS the site emitted.
    // INV-3: strict identity against the literal, never truthiness.
    // INV-7: the mark covers exactly this emission's own union, never another set.
    // INV-21/INV-24: no entry is created to carry a mark, and an unmarked
    // emission allocates no options object.
    if (paths.length > 0) {
      scope.addRange(
        range,
        paths,
        options?.secondary === true ? { secondaryPaths: paths } : undefined
      );
    }
  };

  return {
    get config() {
      return scope.config;
    },
    get lineCount() {
      return elements.length === 0 ? 0 : newlines + 1;
    },
    line(text, extraPaths, options) {
      emit([text], extraPaths, options);
    },
    lines(texts, extraPaths, options) {
      emit(texts, extraPaths, options);
    },
    block(text, extraPaths, options) {
      emit([text], extraPaths, options);
    },
    observe(compute) {
      assertUnsealed();
      return cursor.observe(compute);
    },
    text() {
      if (output === undefined) {
        sealed = true; // INV-17: ranges are already attached; nothing more may be emitted
        scope.drain(); // trailing window: it shaped no bytes of this file
        output = elements.join(separator); // INV-1
      }
      return output;
    },
  };
}
