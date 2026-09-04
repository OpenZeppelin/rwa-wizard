/**
 * In-page measurement for the drawer layout probe.
 *
 * Everything here is serialised with `Function.prototype.toString()` and
 * evaluated inside the tab, so it may reference nothing from module scope —
 * every constant a function needs is either declared inside it or passed as an
 * argument. Keeping the measurement in its own file is what makes the driver
 * swappable later (SF-13 design § 11.2): this module is the only thing that
 * knows the DOM.
 *
 * **Fail-closed is the whole contract of this file (INV-32).** No function here
 * may return a defaulted zero, an `undefined`, or a "not found" sentinel. A
 * selector that matches nothing throws, naming the selector. A rect that is
 * expected to be non-zero is asserted non-zero before it is compared. The
 * failure this discipline exists to prevent is the one that has already been
 * paid for once: `scrollWidth === clientWidth` is trivially true of a missing
 * element at `0 === 0`, so a probe that ran against a page where the drawer
 * never opened would report green for V2, V5 and V7 while measuring nothing.
 */

/** Measured rail widths and the code pane floor the threshold is derived from. */
export const CODE_PANE_FLOOR_PX = 586;

/**
 * The drawer body's horizontal padding (`px-4` = 16px each side). Container
 * width is viewport width minus this, which is why the container query's
 * threshold is 32px below the viewport figure Research recorded.
 */
export const DRAWER_BODY_INSET_PX = 32;

/**
 * Row counts the probe requires its two fixtures to produce, measured against
 * the real Stellar generator on 2026-08-30 with the draft the probe drives the
 * app into (token name/symbol filled, `initial-lockup-period` selected and
 * configured, no roles entered, identity support off):
 *
 * - tall fixture, `accessControl.roles[0].addresses` — re-measured 2026-09-01
 *   after SF-19 quieter Addresses: **3** ranged rows (was 22 over 2 files before
 *   list-root omit on role-guard scans). Floor is 3, not an equality — any further
 *   drop to 0 fails closed. V4 scroll distance may need a different fixture if
 *   three rows no longer clear STICKY_MIN_SCROLL_PX; that is a named residual.
 * - rich fixture, `compliance.modules[0].moduleId` — 8 rows over 5 files,
 *   including the long-path group V7 names, three `created` rows and two
 *   secondary rows.
 *
 * These are floors, not equalities. An equality would fail on any attribution
 * change in the generator — a signal the probe is not the right guard for —
 * while a floor still fails closed the moment the fixture stops producing
 * enough rows for the check that consumes it to mean anything. Note that the
 * design's recorded worst case of 26 rows / 24 in one file is **not** what this
 * draft produces; see the Code Draft artifact's drift note.
 */
export const TALL_FIXTURE_MIN_ROWS = 3;
export const RICH_FIXTURE_MIN_GROUPS = 4;

/** The long path V7 (INV-31) measures the two-line heading against. */
export const LONG_PATH = 'contracts/modules/compliance-initial-lockup-period/src/contract.rs';

/* -------------------------------------------------------------------------- */
/* Serialised into the page                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Shared preamble: helpers every in-page function needs. Prepended to each
 * serialised function body by the driver rather than duplicated in each.
 */
export const PREAMBLE = `
  function fail(message) { throw new Error('probe: ' + message); }
  function must(selector, root) {
    const el = (root || document).querySelector(selector);
    if (el === null) fail('selector matched nothing: ' + selector);
    return el;
  }
  /**
   * The three-region row, with its children named. Asserting the child count
   * here makes INV-1's structure a precondition of every geometric check
   * rather than a separate assertion that could pass while the geometry is
   * measured against the wrong element.
   */
  function regions() {
    const row = must('.rwa-code-preview');
    const kids = Array.prototype.filter.call(row.children, function (n) { return n.nodeType === 1; });
    if (kids.length !== 3) {
      fail('.rwa-code-preview has ' + kids.length + ' element children, expected 3 ' +
        '(tree wrapper, code pane, impact column) — is the column mounted?');
    }
    const column = kids[2];
    if (!column.classList.contains('rwa-code-preview-impact')) {
      fail('third region of .rwa-code-preview is <' + column.tagName.toLowerCase() +
        ' class="' + column.className + '">, expected .rwa-code-preview-impact');
    }
    return { row: row, tree: kids[0], code: kids[1], column: column };
  }
  /** Nearest scrollable ancestor — the sheet body, without depending on kit markup. */
  function scrollParent(el) {
    let node = el.parentElement;
    while (node !== null && node !== document.body) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return node;
      node = node.parentElement;
    }
    fail('no scrollable ancestor found above .rwa-code-preview (the sheet body)');
  }
  function nonZero(value, what) {
    if (!(value > 0)) fail(what + ' measured ' + value + ', expected a non-zero rect — the check would pass vacuously');
    return value;
  }
`;

/**
 * V0 / V1 / V2's raw measurement, plus whether the column is on screen.
 *
 * Returns only numbers and booleans; every threshold comparison is the
 * driver's, so the assertions and their failure messages live in one file.
 */
export function measureGeometry() {
  const r = regions();
  const body = scrollParent(r.row);
  const columnShown = getComputedStyle(r.column).display !== 'none';
  return {
    container: nonZero(r.row.clientWidth, '.rwa-code-preview clientWidth'),
    containerScrollWidth: r.row.scrollWidth,
    tree: r.tree.getBoundingClientRect().width,
    code: nonZero(r.code.clientWidth, 'code pane clientWidth'),
    column: r.column.getBoundingClientRect().width,
    columnShown: columnShown,
    rowHeight: nonZero(r.row.clientHeight, '.rwa-code-preview clientHeight'),
    bodyScrolls: body.scrollHeight > body.clientHeight,
    viewport: window.innerWidth,
  };
}

/**
 * V3's predicate, on its own so the binary search evaluates exactly the thing
 * it is searching over and nothing else.
 */
export function isColumnShown() {
  const r = regions();
  return getComputedStyle(r.column).display !== 'none';
}

/**
 * V4 (INV-28): the column owns its scroll region and the sheet body does not
 * scroll. Both halves in one measurement so they cannot be taken from
 * different frames.
 */
export function measureColumnScroll(minRows) {
  const r = regions();
  if (getComputedStyle(r.column).display === 'none') {
    fail('V4 asked for scroll geometry while the column is suppressed');
  }
  const scroller = must('.rwa-code-preview-impact-scroll', r.column);
  const rows = r.column.querySelectorAll('.rwa-code-preview-impact-row');
  if (rows.length < minRows) {
    fail('tall fixture rendered ' + rows.length + ' rows, expected at least ' + minRows +
      ' — the focused field is not the one this check was measured against');
  }
  const body = scrollParent(r.row);
  return {
    rows: rows.length,
    scrollHeight: nonZero(scroller.scrollHeight, 'column scroller scrollHeight'),
    clientHeight: nonZero(scroller.clientHeight, 'column scroller clientHeight'),
    bodyScrollHeight: nonZero(body.scrollHeight, 'sheet body scrollHeight'),
    bodyClientHeight: nonZero(body.clientHeight, 'sheet body clientHeight'),
  };
}

/**
 * V5 (INV-29): the first file heading is pinned at the scroller's top edge
 * after scrolling. Scrolls first, then measures in the same evaluation, so no
 * frame can land between the two.
 */
export function measureStickyHeading(scrollBy, minScroll) {
  const r = regions();
  if (getComputedStyle(r.column).display === 'none') {
    fail('V5 asked for sticky geometry while the column is suppressed');
  }
  const scroller = must('.rwa-code-preview-impact-scroll', r.column);
  const available = scroller.scrollHeight - scroller.clientHeight;
  // Derive the distance from what there is to scroll, but keep a floor: the
  // point of this check is a heading that has been scrolled PAST, and a 3px
  // nudge would pin the first heading trivially and prove nothing.
  if (available < minScroll) {
    fail('column scroller can only scroll ' + available + 'px, below the ' + minScroll +
      'px floor this check needs to move past a heading — it would measure an unscrolled list');
  }
  scroller.scrollTop = Math.min(scrollBy, available);
  if (scroller.scrollTop <= 0) fail('column scroller did not accept a scroll; scrollTop stayed 0');
  const scrollerTop = scroller.getBoundingClientRect().top;
  const headings = scroller.querySelectorAll('.rwa-code-preview-impact-file');
  if (headings.length === 0) fail('selector matched nothing: .rwa-code-preview-impact-file');
  // The pinned heading is the last one whose top has reached the scroller's top.
  let pinned = headings[0];
  for (let i = 0; i < headings.length; i += 1) {
    if (headings[i].getBoundingClientRect().top <= scrollerTop + 1) pinned = headings[i];
  }
  const rect = pinned.getBoundingClientRect();
  nonZero(rect.height, 'pinned file heading height');
  return {
    delta: rect.top - scrollerTop,
    scrollTop: scroller.scrollTop,
    headings: headings.length,
    opaque: getComputedStyle(pinned).backgroundColor,
  };
}

/**
 * V7 (INV-31): the long path's heading does not overflow, and its leaf is
 * rendered in full. Asserts the heading it measures is the long-path one — the
 * check is worthless against a short path that trivially fits.
 */
export function measureHeadingOverflow(longPath) {
  const r = regions();
  if (getComputedStyle(r.column).display === 'none') {
    fail('V7 asked for heading geometry while the column is suppressed');
  }
  const headings = r.column.querySelectorAll('.rwa-code-preview-impact-file');
  let heading = null;
  for (let i = 0; i < headings.length; i += 1) {
    if (headings[i].getAttribute('title') === longPath) heading = headings[i];
  }
  if (heading === null) {
    const seen = [];
    for (let i = 0; i < headings.length; i += 1) seen.push(headings[i].getAttribute('title'));
    fail('no file heading for the long path ' + longPath + '; headings present: ' + seen.join(', '));
  }
  const leaf = must('.rwa-code-preview-impact-leaf', heading);
  if (leaf.textContent.trim().length === 0) fail('long-path heading leaf rendered no text');
  return {
    headingScrollWidth: heading.scrollWidth,
    headingClientWidth: nonZero(heading.clientWidth, 'long-path heading clientWidth'),
    leafScrollWidth: leaf.scrollWidth,
    leafClientWidth: nonZero(leaf.clientWidth, 'long-path heading leaf clientWidth'),
    leafText: leaf.textContent.trim(),
  };
}

/**
 * V6 (INV-30): at the sheet's height floor the header still names the field,
 * nothing overflows, and the scroller collapses rather than pushing the sheet
 * body into scrolling.
 */
export function measureHeightFloor() {
  const r = regions();
  const body = scrollParent(r.row);
  const header = must('.rwa-code-preview-impact-field', r.column);
  const headerText = header.textContent.trim();
  if (headerText.length === 0) {
    fail('the column header rendered no field name at the sheet height floor — V6 has nothing to assert');
  }
  const scroller = must('.rwa-code-preview-impact-scroll', r.column);
  return {
    rowHeight: nonZero(r.row.clientHeight, '.rwa-code-preview clientHeight at the floor'),
    headerText: headerText,
    headerBottom: header.getBoundingClientRect().bottom,
    columnBottom: r.column.getBoundingClientRect().bottom,
    scrollerHeight: scroller.clientHeight,
    rowOverflows: r.row.scrollWidth > r.row.clientWidth,
    columnOverflows: r.column.scrollWidth > r.column.clientWidth,
    bodyScrolls: body.scrollHeight > body.clientHeight,
  };
}

/**
 * V8 (INV-45): activating a column row leaves the marked range's first line
 * inside the code pane's visible box. Verified, not fixed — the reveal geometry
 * is the kit's.
 */
export function measureRevealVisibility() {
  const r = regions();
  // `data-code-view-reveal` is the kit's own private mark hook, which is exactly
  // what distinguishes a revealed range from a decorator `<mark>`.
  const marked = r.code.querySelector('mark[data-code-view-reveal]');
  if (marked === null) {
    fail('no mark[data-code-view-reveal] in the code pane after activating a column row — ' +
      'the reveal did not land, or the kit mark hook moved');
  }
  const paneRect = r.code.getBoundingClientRect();
  const markRect = marked.getBoundingClientRect();
  nonZero(paneRect.height, 'code pane height');
  return {
    markTop: markRect.top,
    markBottom: markRect.bottom,
    paneTop: paneRect.top,
    paneBottom: paneRect.bottom,
    inside: markRect.top >= paneRect.top - 1 && markRect.top <= paneRect.bottom + 1,
  };
}

/**
 * What the column is showing right now — the diagnostic V9 needs when a Tab walk
 * fails to reach it. "Tab never got there" has two very different causes: the
 * rail is suppressed, or the rail is on screen with nothing focusable in it.
 */
export function describeColumnState() {
  const r = regions();
  const rows = r.column.querySelectorAll('.rwa-code-preview-impact-row');
  let disabled = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].disabled) disabled += 1;
  }
  const active = document.activeElement;
  return {
    shown: getComputedStyle(r.column).display !== 'none',
    rows: rows.length,
    disabledRows: disabled,
    fieldHeader: (r.column.querySelector('.rwa-code-preview-impact-field') || { textContent: '' })
      .textContent.trim(),
    restingText: r.column.textContent.trim().slice(0, 160),
    activeTag: active === null ? null : active.tagName.toLowerCase(),
  };
}

/**
 * V10 — SF-12's one deferred verification, discharged here because a real
 * browser is the only place it can be shown.
 *
 * Two claims, neither of which SF-12's unit suite can make: that `focusin` and
 * `focusout` genuinely fire on the real page the way its hook assumes, and that
 * every control its enumeration collects is genuinely reachable with Tab. The
 * gap this closes is between "the enumeration found N anchored controls" and "a
 * user can actually reach them" — happy-dom lets you focus anything, and a real
 * engine does not.
 *
 * Instruments the page and returns the anchor inventory; the Tab walk itself is
 * the driver's, because it needs real key events.
 */
export function installFocusInstrumentation() {
  const anchors = Array.prototype.slice.call(document.querySelectorAll('[data-config-anchor]'));
  if (anchors.length === 0) {
    fail('no [data-config-anchor] elements on this step — SF-12 anchors are absent, so ' +
      'reachability would be asserted over an empty set');
  }
  anchors.forEach(function (el, index) {
    el.setAttribute('data-probe-anchor-index', String(index));
  });
  window.__probeFocus = { in: 0, out: 0, reached: [] };
  document.addEventListener('focusin', function (event) {
    window.__probeFocus.in += 1;
    const target = event.target;
    const owner = target && target.closest ? target.closest('[data-probe-anchor-index]') : null;
    if (owner !== null) {
      const index = Number(owner.getAttribute('data-probe-anchor-index'));
      if (window.__probeFocus.reached.indexOf(index) === -1) {
        window.__probeFocus.reached.push(index);
      }
    }
  });
  document.addEventListener('focusout', function () {
    window.__probeFocus.out += 1;
  });
  return {
    total: anchors.length,
    keys: anchors.map(function (el) { return el.getAttribute('data-config-anchor'); }),
  };
}

/** Read back what the instrumentation observed, and clean up after itself. */
export function readFocusInstrumentation(cleanup) {
  const state = window.__probeFocus;
  if (state === undefined) fail('focus instrumentation was never installed');
  const anchors = Array.prototype.slice.call(document.querySelectorAll('[data-probe-anchor-index]'));
  const missed = [];
  anchors.forEach(function (el) {
    const index = Number(el.getAttribute('data-probe-anchor-index'));
    if (state.reached.indexOf(index) === -1) {
      missed.push(el.getAttribute('data-config-anchor'));
    }
  });
  if (cleanup) {
    anchors.forEach(function (el) { el.removeAttribute('data-probe-anchor-index'); });
  }
  return {
    focusInEvents: state.in,
    focusOutEvents: state.out,
    reached: state.reached.length,
    total: anchors.length,
    missed: missed,
  };
}

/**
 * V9 (INV-44): what focus is actually on, asserted rather than trusted. SF-11's
 * lesson — a focus test in a browser that never held document focus is a test
 * of nothing.
 */
export function describeFocus() {
  const r = regions();
  const active = document.activeElement;
  return {
    hasFocus: document.hasFocus(),
    tag: active === null ? null : active.tagName.toLowerCase(),
    insideColumn: active !== null && r.column.contains(active),
    insideRow: active !== null && r.row.contains(active),
    isColumnRoot: active === r.column,
    onColumnRow:
      active !== null && active.classList.contains('rwa-code-preview-impact-row'),
    columnRows: r.column.querySelectorAll('.rwa-code-preview-impact-row').length,
    label: active === null ? null : (active.getAttribute('aria-label') || active.textContent || '').trim().slice(0, 80),
    columnShown: getComputedStyle(r.column).display !== 'none',
  };
}

/**
 * The `data-tree-visible` stamp, read as the literal string the container query
 * matches (INV-15). The unit suite pins the same literal; this proves the
 * rendered attribute and the stylesheet's selector agree in a real engine.
 */
export function readTreeVisibleStamp() {
  const row = must('.rwa-code-preview');
  return {
    raw: row.getAttribute('data-tree-visible'),
    present: row.hasAttribute('data-tree-visible'),
  };
}

/**
 * V11 / SC-017 — opaque join between file tree and code pane (SF-20).
 *
 * Happy-dom cannot see layout or sticky paint; this is the only place the join
 * contract is checked. Pass 1's "gutter backgroundColor ≠ transparent" was
 * vacuous for gap-ring-still-transparent: scrolled `<code>` painted *over* a
 * solid sticky gutter. Rev 2 requires z-index / isolation / pad reclaim, and
 * the driver samples a pixel band while still scrolled (see cleanupOpaqueJoin).
 */
export function measureOpaqueJoin() {
  const r = regions();
  if (!r.tree.classList.contains('rwa-code-preview-tree-slot')) {
    fail(
      'tree region is missing .rwa-code-preview-tree-slot — SF-20 paints the slot; ' +
        'without the class the join can open a transparent hole during collapse'
    );
  }
  if (!r.code.classList.contains('rwa-code-preview-code-pane')) {
    fail(
      'code region is missing .rwa-code-preview-code-pane — SF-20\'s opaque chrome ' +
        'and left separator live on that class'
    );
  }
  const pre = must('.rwa-code-preview-code', r.code);

  /**
   * Kit CodeView may emit one `[data-code-view-gutter]` per line. The first in
   * tree order sits at the top of the scrollable source and is often far above
   * the layout viewport — hit-tests and CDP clips then sample empty page chrome.
   * Prefer a gutter whose box intersects the viewport.
   */
  function visibleGutter() {
    const all = r.code.querySelectorAll('[data-code-view-gutter]');
    if (all.length === 0) fail('selector matched nothing: [data-code-view-gutter]');
    const viewTop = 0;
    const viewBottom = window.innerHeight;
    for (let i = 0; i < all.length; i += 1) {
      const rect = all[i].getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) continue;
      if (rect.bottom > viewTop + 4 && rect.top < viewBottom - 4) return all[i];
    }
    // Fallback: scroll the first into view and use it.
    all[0].scrollIntoView({ block: 'center', inline: 'nearest' });
    return all[0];
  }

  let gutter = visibleGutter();

  function isTransparent(bg) {
    return bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
  }

  /** Resolve a CSS colour token the way the browser paints background-color. */
  function resolveBackground(cssColor) {
    const el = document.createElement('div');
    el.style.backgroundColor = cssColor;
    document.body.appendChild(el);
    const resolved = getComputedStyle(el).backgroundColor;
    el.remove();
    return resolved;
  }

  function parseRgb(cssRgb) {
    const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(cssRgb);
    if (match === null) fail('could not parse rgb from ' + cssRgb);
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  }

  const editorToken = getComputedStyle(r.row).getPropertyValue('--rwa-code-preview-editor-bg').trim();
  const sidebarToken = getComputedStyle(r.row).getPropertyValue('--rwa-code-preview-sidebar-bg').trim();
  const gutterFgToken = getComputedStyle(r.row).getPropertyValue('--rwa-code-preview-gutter').trim();
  if (editorToken.length === 0) fail('--rwa-code-preview-editor-bg is unset on .rwa-code-preview');
  if (sidebarToken.length === 0) fail('--rwa-code-preview-sidebar-bg is unset on .rwa-code-preview');
  if (gutterFgToken.length === 0) fail('--rwa-code-preview-gutter is unset on .rwa-code-preview');

  const expectedEditor = resolveBackground(editorToken);
  const expectedSidebar = resolveBackground(sidebarToken);
  const expectedGutterFg = resolveBackground(gutterFgToken);

  const paneStyle = getComputedStyle(r.code);
  const slotStyle = getComputedStyle(r.tree);
  const gutterStyle = getComputedStyle(gutter);
  const preStyle = getComputedStyle(pre);

  const gutterBg = gutterStyle.backgroundColor;
  const paneBg = paneStyle.backgroundColor;
  const slotBg = slotStyle.backgroundColor;

  if (isTransparent(gutterBg)) {
    fail(
      'gutter background-color is transparent — sticky line-start glyphs can bleed ' +
        'through the tree/code join (SC-017 / gap-ring)'
    );
  }
  if (isTransparent(paneBg)) {
    fail('code pane background-color is transparent — the join chrome is not opaque');
  }
  if (isTransparent(slotBg)) {
    fail('tree slot background-color is transparent — collapse can open a hole at the join');
  }

  // Force horizontal overflow so the sticky gutter is painted over scrolled
  // content. Without this, a short line file would skip the failure mode.
  let force = document.querySelector('style[data-probe-opaque-join]');
  if (force === null) {
    force = document.createElement('style');
    force.setAttribute('data-probe-opaque-join', '1');
    force.textContent =
      '.rwa-code-preview-code code, .rwa-code-preview-code .hljs { min-width: 2400px !important; }';
    document.head.appendChild(force);
  }
  // Two frames: layout the forced min-width, then scroll. Leave scrolled —
  // the driver CDP-screenshots the gutter pad band, then calls cleanupOpaqueJoin.
  return new Promise(function (resolve) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const scrollable = pre.scrollWidth > pre.clientWidth + 1;
        if (!scrollable) {
          fail(
            'forced horizontal overflow did not make the code pre scrollable ' +
              '(scrollWidth=' +
              pre.scrollWidth +
              ', clientWidth=' +
              pre.clientWidth +
              ') — SC-017 under scroll cannot be asserted'
          );
        }
        pre.scrollLeft = Math.min(400, pre.scrollWidth - pre.clientWidth);
        if (pre.scrollLeft <= 0) {
          fail('code pre did not accept scrollLeft after forced overflow');
        }
        gutter = visibleGutter();
        const gutterStyleAfter = getComputedStyle(gutter);
        const gutterBgAfterScroll = gutterStyleAfter.backgroundColor;
        const treeWidth = r.tree.getBoundingClientRect().width;
        const gutterRect = gutter.getBoundingClientRect();
        const treeRect = r.tree.getBoundingClientRect();
        if (!(gutterRect.bottom > 4 && gutterRect.top < window.innerHeight - 4)) {
          fail(
            'no [data-code-view-gutter] intersects the layout viewport after scroll ' +
              `(top=${gutterRect.top}, bottom=${gutterRect.bottom}, innerHeight=${window.innerHeight})`
          );
        }
        const zRaw = gutterStyleAfter.zIndex;
        const gutterZIndex = zRaw === 'auto' ? 0 : Number(zRaw);
        if (!Number.isFinite(gutterZIndex)) {
          fail('gutter z-index is not numeric: ' + JSON.stringify(zRaw));
        }
        const borderToken = getComputedStyle(r.row).getPropertyValue('--rwa-code-preview-ui-border').trim();

        // Paint-order oracle (rev 2): with z-index auto, scrolled <code> is hit-tested
        // above the sticky gutter at the pad — the gap-ring-still failure. backgroundColor
        // alone cannot see this.
        //
        // Sample in the pre's visible box — the sticky gutter paints there.
        // A full-height gutter border-box can extend far above/below the viewport;
        // mid-box Y would miss the painted sticky strip.
        const preRect = pre.getBoundingClientRect();
        const visibleTop = Math.max(gutterRect.top, preRect.top, 0) + 4;
        const visibleBottom = Math.min(gutterRect.bottom, preRect.bottom, window.innerHeight) - 4;
        if (visibleBottom - visibleTop < 4) {
          fail(
            'gutter ∩ pre ∩ viewport is too thin to sample ' +
              `(visibleTop=${visibleTop}, visibleBottom=${visibleBottom}, ` +
              `preTop=${preRect.top}, preBottom=${preRect.bottom})`
          );
        }
        const hitX = gutterRect.left + Math.min(6, Math.max(2, gutterRect.width * 0.25));
        const hitY = (visibleTop + visibleBottom) / 2;
        const stack = document.elementsFromPoint(hitX, hitY);
        let codeAboveGutter = false;
        let topIsGutter = false;
        if (stack.length > 0 && (stack[0] === gutter || gutter.contains(stack[0]))) {
          topIsGutter = true;
        } else {
          for (let i = 0; i < stack.length; i += 1) {
            const el = stack[i];
            if (el === gutter || gutter.contains(el)) {
              topIsGutter = !codeAboveGutter;
              break;
            }
            if (el.closest && el.closest('code, .hljs, [class*="hljs"]')) {
              codeAboveGutter = true;
            }
          }
        }

        resolve({
          gutterBg: gutterBg,
          gutterBgAfterScroll: gutterBgAfterScroll,
          paneBg: paneBg,
          slotBg: slotBg,
          expectedEditor: expectedEditor,
          expectedSidebar: expectedSidebar,
          expectedGutterFg: expectedGutterFg,
          editorRgb: parseRgb(expectedEditor),
          gutterFgRgb: parseRgb(expectedGutterFg),
          sidebarRgb: parseRgb(expectedSidebar),
          borderRgb: borderToken.length > 0 ? parseRgb(resolveBackground(borderToken)) : null,
          paneOverflow: paneStyle.overflow,
          paneBorderLeftWidth: paneStyle.borderLeftWidth,
          treeBorderRightWidth: slotStyle.borderRightWidth,
          treeWidth: treeWidth,
          gutterTransparent: isTransparent(gutterBg),
          gutterTransparentAfterScroll: isTransparent(gutterBgAfterScroll),
          scrollLeft: pre.scrollLeft,
          joinGapPx: gutterRect.left - treeRect.right,
          gutterZIndex: gutterZIndex,
          preIsolation: preStyle.isolation,
          prePaddingLeft: preStyle.paddingLeft,
          preBorderLeftWidth: preStyle.borderLeftWidth,
          gutterPaddingLeft: gutterStyleAfter.paddingLeft,
          hitTest: {
            x: hitX,
            y: hitY,
            topIsGutter: topIsGutter,
            codeAboveGutter: codeAboveGutter,
            topTag: stack.length > 0 ? stack[0].tagName : null,
            topClass: stack.length > 0 ? String(stack[0].className || '').slice(0, 80) : null,
          },
          gutterRect: {
            left: gutterRect.left,
            top: gutterRect.top,
            width: gutterRect.width,
            height: gutterRect.height,
          },
          pixelBand: {
            left: hitX - 2,
            top: hitY - 4,
            width: 8,
            height: Math.max(8, Math.min(20, gutterRect.height)),
          },
        });
      });
    });
  });
}

/** Undo measureOpaqueJoin's forced overflow + scroll so later checks are undisturbed. */
export function cleanupOpaqueJoin() {
  const force = document.querySelector('style[data-probe-opaque-join]');
  if (force !== null) force.remove();
  const pre = document.querySelector('.rwa-code-preview-code');
  if (pre !== null) pre.scrollLeft = 0;
  return true;
}

/**
 * SF-23 dock chrome snapshot — props/attributes only, not edge geometry (INV-24).
 * Layer must stay pointer-events:none so overlay never traps the form (INV-12).
 * closeToolsDeltaY: midY(Close) − mean midY(tool buttons); must be ~0 when aligned.
 */
export function measureDockChrome() {
  const sheet = document.querySelector('[data-slot="bottom-sheet"].rwa-code-preview-sheet');
  if (sheet === null) {
    throw new Error('probe: bottom-sheet.rwa-code-preview-sheet not mounted');
  }
  const layer = document.querySelector('[data-slot="bottom-sheet-layer"]');
  const sideAttr = document.documentElement.getAttribute('data-bottom-sheet-side');
  const dataSide = sheet.getAttribute('data-side');
  const toolsGroup = sheet.querySelector('[data-slot="bottom-sheet-header"] [role="group"]');
  const toolButtons = toolsGroup
    ? Array.from(toolsGroup.querySelectorAll('button'))
    : Array.from(sheet.querySelectorAll('[data-slot="bottom-sheet-header"] button'));
  const close = sheet.querySelector('[data-slot="bottom-sheet-close"]');
  const headerButtons = Array.from(
    sheet.querySelectorAll('[data-slot="bottom-sheet-header"] button, [data-slot="bottom-sheet-close"]')
  );
  const toolsOperable = headerButtons.length > 0 && headerButtons.every((btn) => !btn.disabled);
  const layerPe =
    layer === null ? null : getComputedStyle(layer).pointerEvents;

  let closeToolsDeltaY = null;
  if (close !== null && toolButtons.length > 0) {
    const closeRect = close.getBoundingClientRect();
    const closeMid = (closeRect.top + closeRect.bottom) / 2;
    const toolsMid =
      toolButtons.reduce((sum, btn) => {
        const r = btn.getBoundingClientRect();
        return sum + (r.top + r.bottom) / 2;
      }, 0) / toolButtons.length;
    closeToolsDeltaY = Math.round((closeMid - toolsMid) * 100) / 100;
  }

  return {
    dataSide,
    sideAttr,
    toolsCount: headerButtons.length,
    toolsOperable,
    layerPointerEvents: layerPe,
    previewPresent: document.querySelector('.rwa-code-preview') !== null,
    closeToolsDeltaY,
    closeHeight: close === null ? null : close.getBoundingClientRect().height,
    toolHeight:
      toolButtons.length === 0 ? null : toolButtons[0].getBoundingClientRect().height,
  };
}

/**
 * SF-23 desktop geometry (INV-20 / INV-25) — form content box must not intersect
 * the sheet content box while inset. Overlay cases are excluded by the caller.
 * Happy-dom must not assert this (INV-24).
 */
export function measureDockGeometry() {
  const sheet = document.querySelector('[data-slot="bottom-sheet"].rwa-code-preview-sheet');
  if (sheet === null) {
    throw new Error('probe: bottom-sheet.rwa-code-preview-sheet not mounted');
  }
  const code = document.querySelector('.rwa-code-preview-code');
  if (code === null) {
    throw new Error('probe: .rwa-code-preview-code not mounted');
  }
  const formField =
    document.querySelector('input[name="tokenName"], input[aria-label*="Token name" i], #token-name') ||
    document.querySelector('main input, main textarea, main button');
  if (formField === null) {
    throw new Error('probe: no form control found for dock geometry');
  }
  const sheetRect = sheet.getBoundingClientRect();
  const formRect = formField.getBoundingClientRect();
  const codeRect = code.getBoundingClientRect();
  const intersects = !(
    sheetRect.right <= formRect.left ||
    sheetRect.left >= formRect.right ||
    sheetRect.bottom <= formRect.top ||
    sheetRect.top >= formRect.bottom
  );
  const sideAttr = document.documentElement.getAttribute('data-bottom-sheet-side');
  const insetAttr = document.documentElement.hasAttribute('data-bottom-sheet-inset');
  return {
    dataSide: sheet.getAttribute('data-side'),
    sideAttr,
    insetAttr,
    sheet: {
      width: sheetRect.width,
      height: sheetRect.height,
      top: sheetRect.top,
      left: sheetRect.left,
    },
    form: {
      width: formRect.width,
      height: formRect.height,
      top: formRect.top,
      left: formRect.left,
    },
    codeReadable: codeRect.width >= 80 && codeRect.height >= 40,
    formSheetIntersect: intersects,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
}

/**
 * SF-23 narrow overlay click-through (INV-11 / INV-12): while a side dock is
 * open as overlay, a form control outside the sheet region must still receive
 * pointer events (layer is pointer-events:none).
 */
export function measureOverlayFormReachability() {
  const sheet = document.querySelector('[data-slot="bottom-sheet"].rwa-code-preview-sheet');
  if (sheet === null) {
    throw new Error('probe: bottom-sheet.rwa-code-preview-sheet not mounted');
  }
  const layer = document.querySelector('[data-slot="bottom-sheet-layer"]');
  const layerPe = layer === null ? null : getComputedStyle(layer).pointerEvents;
  const sideAttr = document.documentElement.getAttribute('data-bottom-sheet-side');
  const insetAttr = document.documentElement.hasAttribute('data-bottom-sheet-inset');
  const formField =
    document.querySelector('input[name="tokenName"], input[aria-label*="Token name" i], #token-name') ||
    document.querySelector('main input, main textarea, main button');
  if (formField === null) {
    throw new Error('probe: no form control found for overlay reachability');
  }
  const sheetRect = sheet.getBoundingClientRect();
  const formRect = formField.getBoundingClientRect();
  // Sample a point inside the form control; if it lies outside the sheet box,
  // elementFromPoint must resolve to something that is not the sheet layer trap.
  const x = Math.min(formRect.left + 8, formRect.right - 2);
  const y = Math.min(formRect.top + 8, formRect.bottom - 2);
  const hit = document.elementFromPoint(x, y);
  const hitInsideSheet = hit !== null && sheet.contains(hit);
  return {
    dataSide: sheet.getAttribute('data-side'),
    sideAttr,
    insetPublished: insetAttr,
    layerPointerEvents: layerPe,
    formOutsideSheet:
      formRect.right <= sheetRect.left ||
      formRect.left >= sheetRect.right ||
      formRect.bottom <= sheetRect.top ||
      formRect.top >= sheetRect.bottom,
    hitInsideSheet,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
}

