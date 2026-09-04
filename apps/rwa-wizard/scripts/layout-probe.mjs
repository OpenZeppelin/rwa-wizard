#!/usr/bin/env node
/**
 * Drawer layout probe — SF-13 (INV-24 … INV-34, INV-44, INV-45).
 *
 * The three-region drawer layout is the half of this feature that fails
 * *silently*: no configuration overflows, nothing throws, and the app's unit
 * suite is happy-dom, which has no layout engine — every rect is zero, a
 * container query never evaluates, `position: sticky` is never applied and
 * `scrollIntoView` is a no-op. So the layout rule is either checked in a real
 * engine or it is not checked at all (INV-23).
 *
 * Zero dependencies, by measurement rather than preference: Node 22's global
 * `WebSocket` plus raw CDP was tried before the design committed and worked
 * first run, and a new devDependency is a lockfile change that has to clear
 * CI's licence guard, which runs before install.
 *
 * ## Three invocations, all expected to exit 0
 *
 * | Invocation                    | What it proves                                     |
 * |-------------------------------|----------------------------------------------------|
 * | `node layout-probe.mjs`       | the layout rule holds (V0–V9, V11/SC-017)          |
 * | `PROBE_SELF_CHECK=1 …`        | V1 and V3 **fail** under a stylesheet that forces   |
 * |                               | the column visible at every width (INV-33)         |
 * | `PROBE_NEGATIVE=1 …`          | the probe fails closed against a page that never   |
 * |                               | rendered the drawer, naming the precondition       |
 * |                               | (INV-32)                                           |
 *
 * The two inverted runs assert the **specific** expected failure, never merely
 * a non-zero exit. A probe that crashes on a null dereference before running V1
 * also exits non-zero, and a self-check satisfied by that has proven nothing.
 *
 * ## Environment
 *
 * - `CHROME_PATH`      — explicit Chrome/Chromium binary; otherwise resolved
 *                        from a candidate list, with a hard failure naming what
 *                        to install. Never a skip.
 * - `PROBE_BASE_URL`   — an already-running preview server. Omit and the probe
 *                        spawns `vite preview` itself, waits for it with a
 *                        bounded timeout, and reaps it on exit. § 11.4's CI
 *                        snippet backgrounded the server and waited for
 *                        nothing; a probe that races the server it measures is
 *                        worse than no probe.
 * - `PROBE_HEADFUL=1`  — run with a visible window, for debugging.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import {
  CODE_PANE_FLOOR_PX,
  DRAWER_BODY_INSET_PX,
  LONG_PATH,
  PREAMBLE,
  RICH_FIXTURE_MIN_GROUPS,
  TALL_FIXTURE_MIN_ROWS,
  describeFocus,
  isColumnShown,
  measureColumnScroll,
  measureGeometry,
  measureHeadingOverflow,
  measureHeightFloor,
  measureOpaqueJoin,
  cleanupOpaqueJoin,
  measureRevealVisibility,
  measureStickyHeading,
  readTreeVisibleStamp,
  describeColumnState,
  installFocusInstrumentation,
  readFocusInstrumentation,
  measureDockChrome,
  measureDockGeometry,
  measureOverlayFormReachability,
} from './layout-probe.checks.mjs';

/** Measured tree rail width — SF-13 V3 / SF-20 must not move this with a tree-side border. */
const TREE_RAIL_PX = 280;

/**
 * Max Euclidean RGB distance from editor ground (or gutter fg) allowed in the
 * gutter pad band after horizontal scroll. Syntax-coloured glyphs (gap-ring-still)
 * land far outside this; AA against digits stays inside.
 */
const GUTTER_BAND_RGB_TOLERANCE = 28;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '..');

/** The three supported viewports. Outside these the drawer is already unusable today. */
const VIEWPORTS = [
  { label: '1280x900', width: 1280, height: 900 },
  { label: '1024x800', width: 1024, height: 800 },
  { label: '900x700', width: 900, height: 700 },
];

/** Code-pane widths recorded by the design's pre-commit measurement, per configuration. */
const RECORDED_CODE_PANE_PX = {
  '1280x900/tree': 708,
  '1280x900/no-tree': 988,
  '1024x800/tree': 712,
  '1024x800/no-tree': 732,
  '900x700/tree': 588,
  '900x700/no-tree': 608,
};

/** The sheet's persisted height floor. Reachable by drag; V6 pins that it has no special mode. */
const SHEET_FLOOR_PX = 160;

/**
 * Floor for V5's scroll distance. The check scrolls `min(200, available)`; below
 * this the scroll would not clear a heading and the pin would be trivial.
 */
const STICKY_MIN_SCROLL_PX = 60;

/** Tolerance for a derived-geometry identity, in px. Borders and sub-pixel rounding only. */
const GEOMETRY_TOLERANCE_PX = 2;

/** The wizard's default network route, entered directly so no redirect remounts the form. */
const WIZARD_PATH = '/wizard/stellar-testnet';

const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_PORT = 4173;
const SERVER_READY_TIMEOUT_MS = 60_000;
const APP_READY_TIMEOUT_MS = 30_000;
const GENERATE_TIMEOUT_MS = 20_000;

/**
 * Every check the run must produce. Listed rather than counted so a missing one
 * is named: "5 checks ran" is satisfied by the wrong five.
 */
/**
 * How long a row activation has to produce its mark.
 *
 * Generous on purpose: an activation during a refresh is satisfied only once
 * the regeneration it is waiting on lands, and that is a generate, not a frame.
 */
const REVEAL_TIMEOUT_MS = 5000;

const EXPECTED_CHECK_IDS = [
  'V0',
  'V1',
  'V2',
  'INV-15',
  'V3',
  'V4',
  'V5',
  'V7',
  'V9',
  'V10',
  'V6',
  'V8',
  'V11',
  'SF23-DOCK',
  'SF23-DOCK-GEO',
  'SF23-DOCK-NARROW',
];

const SELF_CHECK = process.env.PROBE_SELF_CHECK === '1';
const NEGATIVE = process.env.PROBE_NEGATIVE === '1';

/** The stylesheet the self-check injects: the column visible at every width. */
const SELF_CHECK_CSS = `
  @container rwa-preview (width < 100000px) {
    .rwa-code-preview[data-tree-visible='true'] .rwa-code-preview-impact { display: flex !important; }
  }
  .rwa-code-preview-impact { display: flex !important; }
`;

/* ========================================================================== */
/* Result collection                                                           */
/* ========================================================================== */

/**
 * A check's outcome. `failures` is empty on success. Failures are collected
 * rather than thrown so one broken configuration does not hide the other five —
 * the run still exits non-zero, and the whole failure list is the worklist.
 */
class Check {
  constructor(id, title) {
    this.id = id;
    this.title = title;
    this.failures = [];
    this.notes = [];
  }

  fail(message) {
    this.failures.push(message);
  }

  note(message) {
    this.notes.push(message);
  }

  /** `expected` and `actual` are printed on failure so the message is a diagnosis, not a verdict. */
  expect(condition, message) {
    if (!condition) this.fail(message);
    return condition;
  }

  get passed() {
    return this.failures.length === 0;
  }
}

class ProbeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProbeError';
  }
}

/* ========================================================================== */
/* Chrome resolution — a hard failure naming what to install, never a skip      */
/* ========================================================================== */

function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter((candidate) => typeof candidate === 'string' && candidate.length > 0);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new ProbeError(
    'no Chrome or Chromium binary found. Tried:\n  ' +
      candidates.join('\n  ') +
      '\nInstall Google Chrome, or set CHROME_PATH to a Chromium binary. ' +
      'This probe is the only guard for a layout failure that is silent in every ' +
      'other check, so it is never skipped.'
  );
}

/* ========================================================================== */
/* Preview server — spawned and waited for, or reused                           */
/* ========================================================================== */

async function waitForHttp(url, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no attempt made';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(200);
  }
  throw new ProbeError(
    `${what} did not answer at ${url} within ${timeoutMs}ms (last: ${lastError}). ` +
      'A timeout is a failure, not a retry: measuring against a server that has not ' +
      'started is how a probe reports green having measured nothing.'
  );
}

async function startPreviewServer() {
  if (process.env.PROBE_BASE_URL) {
    const baseUrl = process.env.PROBE_BASE_URL.replace(/\/$/, '');
    await waitForHttp(baseUrl, SERVER_READY_TIMEOUT_MS, 'the preview server named by PROBE_BASE_URL');
    return { baseUrl, stop: async () => {} };
  }

  // `--host 127.0.0.1` is load-bearing, not tidiness: vite's default binds to
  // `localhost`, which resolves to ::1 first, and a probe polling 127.0.0.1
  // then waits out its whole timeout against a server that is up and listening.
  const child = spawn(
    'pnpm',
    [
      'exec',
      'vite',
      'preview',
      '--host',
      PREVIEW_HOST,
      '--port',
      String(PREVIEW_PORT),
      '--strictPort',
    ],
    { cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let serverLog = '';
  child.stdout.on('data', (chunk) => {
    serverLog += chunk;
  });
  child.stderr.on('data', (chunk) => {
    serverLog += chunk;
  });

  const exited = new Promise((_, reject) => {
    child.on('exit', (code) => {
      reject(
        new ProbeError(
          `vite preview exited with code ${code} before answering. Did \`pnpm build\` run?\n${serverLog}`
        )
      );
    });
  });

  const baseUrl = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
  await Promise.race([
    waitForHttp(baseUrl, SERVER_READY_TIMEOUT_MS, 'the vite preview server'),
    exited,
  ]);

  return {
    baseUrl,
    stop: async () => {
      child.removeAllListeners('exit');
      child.kill('SIGTERM');
    },
  };
}

/* ========================================================================== */
/* Minimal CDP client                                                          */
/* ========================================================================== */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.sessionId = null;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id === undefined) return;
      const entry = this.pending.get(message.id);
      if (entry === undefined) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new ProbeError(`CDP ${message.error.message}`));
      else entry.resolve(message.result);
    });
  }

  static async connect(wsUrl) {
    const socket = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new ProbeError('CDP socket failed to open')), {
        once: true,
      });
    });
    return new Cdp(socket);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (this.sessionId !== null) payload.sessionId = this.sessionId;
    this.socket.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  /** Browser-scoped send, for the target commands that must not carry a session. */
  sendBrowser(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.socket.close();
  }
}

async function launchChrome(chromePath) {
  const profileDir = mkdtempSync(path.join(tmpdir(), 'rwa-layout-probe-'));
  const args = [
    process.env.PROBE_HEADFUL === '1' ? '--headless=false' : '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    // NOT --hide-scrollbars: the measurement must be the pessimistic one on
    // platforms with classic scrollbars. A scrollbar lives inside the column's
    // own scroller, so it costs the column and never the code pane.
  ];
  // Only under CI, and only there: the sandbox is a real protection locally.
  if (process.env.CI) args.push('--no-sandbox');

  const child = spawn(chromePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new ProbeError(`Chrome did not print a DevTools endpoint within 30s:\n${buffer}`));
    }, 30_000);
    child.stderr.on('data', (chunk) => {
      buffer += chunk;
      const match = buffer.match(/ws:\/\/[^\s]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new ProbeError(`Chrome exited with code ${code} before starting:\n${buffer}`));
    });
  });

  const cdp = await Cdp.connect(wsUrl);
  const { targetId } = await cdp.sendBrowser('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.sendBrowser('Target.attachToTarget', { targetId, flatten: true });
  cdp.sessionId = sessionId;

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

  return {
    cdp,
    // Teardown is best-effort and must never mask a result: a temp profile that
    // outlives the run is noise, whereas an exception here would replace the
    // probe's verdict with a filesystem error.
    stop: async () => {
      cdp.close();
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      await Promise.race([exited, sleep(3_000)]);
      try {
        rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // The OS will reap it; the run's verdict is what matters.
      }
    },
  };
}

/* ========================================================================== */
/* Page helpers                                                                */
/* ========================================================================== */

/** Evaluate an in-page check function with the shared preamble in scope. */
async function callInPage(cdp, fn, ...args) {
  const expression = `(function () {\n${PREAMBLE}\nreturn (${fn.toString()}).apply(null, ${JSON.stringify(args)});\n})()`;
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    const description =
      exceptionDetails.exception?.description ?? exceptionDetails.text ?? 'unknown in-page error';
    throw new ProbeError(description.split('\n')[0]);
  }
  return result.value;
}

/** Evaluate a raw expression; used for driving, never for measuring. */
async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    const description =
      exceptionDetails.exception?.description ?? exceptionDetails.text ?? 'unknown in-page error';
    throw new ProbeError(description.split('\n')[0]);
  }
  return result.value;
}

/**
 * Wait for a boolean expression, with a bounded timeout whose expiry is a
 * failure naming what was waited for. Every precondition in this probe goes
 * through here, which is what makes "asserted by name" mechanical rather than
 * a convention.
 */
async function waitFor(cdp, expression, what, timeoutMs = APP_READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(cdp, `Boolean(${expression})`);
    if (value === true) return;
    await sleep(100);
  }
  throw new ProbeError(`precondition not met within ${timeoutMs}ms: ${what}\n  expression: ${expression}`);
}

/**
 * Wait until a node has stopped being remounted.
 *
 * The wizard hydrates its draft from IndexedDB after first paint, which
 * replaces the step form and drops focus to `<body>`. A `sleep` would paper
 * over that; stamping the node and requiring the stamp to survive a quiet
 * period asks the actual question — is this the same element I am about to
 * focus — and fails by name when it never settles.
 */
async function waitForStable(cdp, selector, what, quietMs = 700) {
  const literal = JSON.stringify(selector);
  const deadline = Date.now() + APP_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await evaluate(
      cdp,
      `(() => {
        const el = document.querySelector(${literal});
        if (el !== null) el.setAttribute('data-probe-stamp', '1');
        return true;
      })()`
    );
    await sleep(quietMs);
    const stable = await evaluate(
      cdp,
      `(() => {
        const el = document.querySelector(${literal});
        return el !== null && el.getAttribute('data-probe-stamp') === '1';
      })()`
    );
    if (stable === true) {
      await evaluate(
        cdp,
        `(() => {
          const el = document.querySelector(${literal});
          if (el !== null) el.removeAttribute('data-probe-stamp');
          return true;
        })()`
      );
      return;
    }
  }
  throw new ProbeError(
    `${what} kept being remounted and never settled within ${APP_READY_TIMEOUT_MS}ms (${selector})`
  );
}

async function setViewport(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // One frame for the container query to re-evaluate before anything is measured.
  await evaluate(cdp, 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
}

/** Transitions off before measuring — SF-11's discipline, carried rather than rediscovered. */
async function freezeAnimations(cdp) {
  await evaluate(
    cdp,
    `(() => {
      let style = document.getElementById('probe-freeze');
      if (style === null) {
        style = document.createElement('style');
        style.id = 'probe-freeze';
        style.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;}';
        document.head.appendChild(style);
      }
      return true;
    })()`
  );
}

async function injectSelfCheckStylesheet(cdp) {
  await evaluate(
    cdp,
    `(() => {
      let style = document.getElementById('probe-self-check');
      if (style === null) {
        style = document.createElement('style');
        style.id = 'probe-self-check';
        style.textContent = ${JSON.stringify(SELF_CHECK_CSS)};
        document.head.appendChild(style);
      }
      return true;
    })()`
  );
}

/**
 * Focus an element by selector, asserting it actually took focus.
 *
 * `.focus()` on a hidden element is a no-op in a real browser and leaves focus
 * on `<body>` — a trap this repo has already paid for. Asserting the result
 * turns that into a named failure instead of a column that silently renders
 * "No field selected".
 */
async function focusSelector(cdp, selector, what) {
  const ok = await evaluate(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el === null) return 'missing';
      el.focus();
      return document.activeElement === el ? 'ok' : 'refused';
    })()`
  );
  if (ok === 'missing') throw new ProbeError(`cannot focus ${what}: no element matched ${selector}`);
  if (ok === 'refused') {
    throw new ProbeError(
      `${what} refused focus (${selector}); document.activeElement stayed elsewhere. ` +
        'A hidden or disabled element cannot take focus in a real engine.'
    );
  }
  await sleep(50);
}

async function clickSelector(cdp, selector, what) {
  const ok = await evaluate(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el === null) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    })()`
  );
  if (ok !== true) throw new ProbeError(`cannot click ${what}: no element matched ${selector}`);
  await sleep(120);
}

async function clickButtonByName(cdp, name, what) {
  const outcome = await evaluate(
    cdp,
    `(() => {
      const wanted = ${JSON.stringify(name)};
      const buttons = Array.from(document.querySelectorAll('button'));
      const nameOf = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim();
      const match = buttons.find((b) => nameOf(b) === wanted && !b.disabled);
      if (match !== undefined) {
        match.scrollIntoView({ block: 'center' });
        match.click();
        return { ok: true };
      }
      return { ok: false, seen: buttons.map((b) => (b.disabled ? '[disabled] ' : '') + nameOf(b)).filter(Boolean) };
    })()`
  );
  if (outcome.ok !== true) {
    throw new ProbeError(
      `cannot click ${what}: no enabled <button> named "${name}". Buttons on the page: ` +
        outcome.seen.map((label) => JSON.stringify(label)).join(', ')
    );
  }
  await sleep(200);
}

/**
 * Real pointer click via CDP — Radix DropdownMenu often ignores synthetic
 * `HTMLElement.click()` / pointerenter alone in headless Chrome.
 */
async function clickButtonByNameWithMouse(cdp, name, what) {
  const box = await evaluate(
    cdp,
    `(() => {
      const wanted = ${JSON.stringify(name)};
      const nameOf = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim();
      const match = Array.from(document.querySelectorAll('button')).find(
        (b) => nameOf(b) === wanted && !b.disabled
      );
      if (match === undefined) return null;
      match.scrollIntoView({ block: 'center' });
      const r = match.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`
  );
  if (box === null || typeof box.x !== 'number') {
    // Fall back to the synthetic path so the error message still lists buttons.
    await clickButtonByName(cdp, name, what);
    return;
  }
  const opts = { button: 'left', buttons: 1, clickCount: 1, x: box.x, y: box.y };
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...opts, buttons: 0 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...opts });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...opts, buttons: 0 });
  await sleep(200);
}

/**
 * Open the dock-position hover/focus menu and pick a radio item by accessible name.
 * Wizard offers bottom + left only; other apps may pass a fuller menu.
 */
async function setDockViaMenu(cdp, position, what) {
  const itemLabel = `Dock preview to ${position}`;
  // Prefer hover-open (product UX); fall back to click if the menu stays closed.
  await clickButtonByNameWithMouse(cdp, 'Dock position', `click-open dock menu (${what})`);

  let outcome = { ok: false, seen: [] };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    outcome = await evaluate(
      cdp,
      `(() => {
        const wanted = ${JSON.stringify(itemLabel)};
        const items = Array.from(
          document.querySelectorAll('[role="menuitemradio"], [role="menuitem"]')
        );
        const nameOf = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim();
        const match = items.find((el) => nameOf(el) === wanted);
        if (match === undefined) {
          return {
            ok: false,
            seen: items.map((el) => nameOf(el)).filter(Boolean),
            open: items.length > 0,
          };
        }
        match.click();
        return { ok: true, seen: items.map((el) => nameOf(el)).filter(Boolean) };
      })()`
    );
    if (outcome.ok === true) {
      break;
    }
    if (attempt === 2) {
      await clickButtonByNameWithMouse(cdp, 'Dock position', `retry click-open dock menu (${what})`);
    }
    await sleep(80);
  }
  if (outcome.ok !== true) {
    throw new ProbeError(
      `cannot ${what}: no menu item named "${itemLabel}". Menu items: ` +
        (outcome.seen ?? []).map((label) => JSON.stringify(label)).join(', ')
    );
  }
  await sleep(250);
}

/** Accessible names currently listed in the open dock menu (empty if closed). */
async function listDockMenuLabels(cdp) {
  await clickButtonByNameWithMouse(cdp, 'Dock position', 'click-open dock menu to list entries');
  let labels = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    labels = await evaluate(
      cdp,
      `(() => {
        const items = Array.from(
          document.querySelectorAll('[role="menuitemradio"], [role="menuitem"]')
        );
        return items
          .map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim())
          .filter(Boolean);
      })()`
    );
    if (labels.length > 0) {
      break;
    }
    if (attempt === 2) {
      await clickButtonByNameWithMouse(cdp, 'Dock position', 'retry click-open dock menu to list entries');
    }
    await sleep(80);
  }
  // Dismiss so later clicks are not blocked by the menu layer.
  await evaluate(
    cdp,
    `(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return true;
    })()`
  );
  await sleep(100);
  return labels;
}

/**
 * Type into a field with real key events, and verify the value arrived.
 *
 * `Input.insertText` and the native-setter + synthetic-event trick both bypass
 * react-hook-form: the DOM shows the value and the form state never receives
 * it, so the step stays invalid and navigation silently refuses.
 *
 * Bounded retry, not a longer sleep. The wizard re-hydrates its draft from
 * storage and remounts the step form at a time that varies run to run, so a
 * keystroke can land in an element React is replacing. Retrying asks the
 * question that matters — did the value arrive — and still fails by name when
 * it never does, where a longer sleep would only move the flake.
 */
async function typeInto(cdp, selector, text, what) {
  const attempts = 4;
  let lastState = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await focusSelector(cdp, selector, what);

    // A previous attempt may have left a partial value behind.
    const existing = await evaluate(
      cdp,
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        return el === null ? 0 : String(el.value ?? '').length;
      })()`
    );
    for (let i = 0; i < existing; i += 1) {
      await pressKey(cdp, 'Backspace', 8);
    }

    for (const char of text) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        text: char,
        unmodifiedText: char,
        key: char,
      });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: char });
    }
    await sleep(150);

    lastState = await evaluate(
      cdp,
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        const active = document.activeElement;
        return {
          value: el === null ? null : el.value,
          tag: el === null ? null : el.tagName.toLowerCase(),
          activeTag: active === null ? null : active.tagName.toLowerCase(),
          activeId: active === null ? null : active.id,
          stillFocused: active === el,
        };
      })()`
    );
    if (lastState.value === text) return;
    await sleep(400);
  }

  throw new ProbeError(
    `typing into ${what} (${selector}) produced ${JSON.stringify(lastState?.value)} after ` +
      `${attempts} attempts, expected ${JSON.stringify(text)} — element <${lastState?.tag}>, ` +
      `focus ended on <${lastState?.activeTag}${lastState?.activeId ? ' id=' + lastState.activeId : ''}> ` +
      `(${lastState?.stillFocused ? 'same element' : 'focus moved away'})`
  );
}

async function pressKey(cdp, key, windowsVirtualKeyCode) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, windowsVirtualKeyCode });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode });
  await sleep(60);
}

/* ========================================================================== */
/* Driving the app into the state the checks need                              */
/* ========================================================================== */

const SELECTOR = {
  tokenName: '#token-name',
  tokenSymbol: '#token-symbol',
  lockupCard: '[data-config-anchor="module|initial-lockup-period"]',
  lockupField: '#initial-lockup-period-lockupPeriodLedgers',
  roleAddressInput: '[data-config-anchor^="role|"] input',
  previewRow: '.rwa-code-preview',
  column: '.rwa-code-preview-impact',
  columnRow: '.rwa-code-preview-impact-row',
};

/** The tree toggle's two accessible names, owned by the copy package. INV-44. */
const SELECTOR_TREE_TOGGLE_SHOW = 'Show file tree';
const SELECTOR_TREE_TOGGLE_HIDE = 'Hide file tree';

/**
 * Load the app with a known storage state and drive it to the Compliance step
 * with the preview drawer open.
 *
 * Every wait here is a named precondition (INV-32 clause 1). The sequence is
 * the ordinary user route rather than a seeded store, because the height chain
 * this probe exists to measure — `BottomSheet`'s clamp, the published inset,
 * the sheet chrome, the body padding, the three-region row — only exists in the
 * real app.
 */
async function prepareApp(cdp, baseUrl, { heightPx, treeVisible }) {
  await cdp.send('Page.navigate', { url: `${baseUrl}${WIZARD_PATH}` });
  await waitFor(cdp, 'document.readyState === "complete"', 'the app document to load');

  await evaluate(
    cdp,
    `(() => {
      localStorage.setItem('rwa-wizard:code-preview:open', 'false');
      localStorage.setItem('rwa-wizard:code-preview:height:v2', ${JSON.stringify(String(heightPx))});
      localStorage.setItem('rwa-wizard:code-preview:tree', ${JSON.stringify(String(treeVisible))});
      localStorage.setItem('rwa-wizard:code-preview:dock', 'bottom');
      return true;
    })()`
  );

  await cdp.send('Page.navigate', { url: `${baseUrl}${WIZARD_PATH}` });
  await waitFor(cdp, 'document.readyState === "complete"', 'the app document to reload');
  await waitFor(
    cdp,
    `document.querySelector(${JSON.stringify(SELECTOR.tokenName)}) !== null`,
    'the wizard Asset step to render'
  );
  // The draft hydrates from storage after first paint; focusing before that
  // lands on an element React is about to replace.
  await waitForStable(cdp, SELECTOR.tokenName, 'the wizard Asset step');
  await freezeAnimations(cdp);

  // The asset step is invalid on a fresh draft (empty name and symbol), and an
  // invalid step disables Next — so this is navigation, not decoration.
  await typeInto(cdp, SELECTOR.tokenName, 'Probe Token', 'the token name field');
  await typeInto(cdp, SELECTOR.tokenSymbol, 'PRB', 'the token symbol field');

  await clickButtonByName(cdp, 'Next', 'Next (Asset → Identity)');
  await clickButtonByName(cdp, 'Next', 'Next (Identity → Compliance)');
  await waitFor(
    cdp,
    `document.querySelector(${JSON.stringify(SELECTOR.lockupCard)}) !== null`,
    'the Compliance step module catalog to render'
  );
  await waitForStable(cdp, SELECTOR.lockupCard, 'the Compliance step module catalog');

  // The rich fixture: this module contributes the long-path group V7 measures,
  // three `created` rows, two secondary rows and the 34-line range V8 uses.
  await clickSelector(cdp, SELECTOR.lockupCard, 'the Initial Lockup Period module card');
  await waitFor(
    cdp,
    `document.querySelector(${JSON.stringify(SELECTOR.lockupField)}) !== null`,
    'the lockup module config field to render'
  );
  // The config panel mounts as a consequence of the selection, so its first
  // render is followed by another; typing into the first one loses a keystroke.
  await waitForStable(cdp, SELECTOR.lockupField, 'the lockup module config field');
  // Required: a selected module with no config leaves the Compliance step
  // invalid, which would block the later hop to Roles.
  await typeInto(cdp, SELECTOR.lockupField, '17280', 'the lockup duration field');

  await clickButtonByName(cdp, 'View generated code', 'the code preview trigger');
  await waitFor(
    cdp,
    `document.querySelector(${JSON.stringify(SELECTOR.previewRow)}) !== null`,
    'the preview drawer to reach phase "ready" and render the three-region row',
    GENERATE_TIMEOUT_MS
  );
  await freezeAnimations(cdp);

  if (SELF_CHECK) await injectSelfCheckStylesheet(cdp);
}

/**
 * Focus the rich fixture — the module card, which resolves to
 * `compliance.modules[0]`.
 *
 * The two fixtures live on different steps and the tall one navigates forward
 * to Roles, so each fixture owns getting back to its own step. Doing this by
 * asking the DOM rather than by tracking a step index means the walk cannot
 * drift out of sync with where the app actually is.
 */
async function focusRichFixture(cdp) {
  const present = await evaluate(
    cdp,
    `document.querySelector(${JSON.stringify(SELECTOR.lockupCard)}) !== null`
  );
  if (present !== true) {
    await clickButtonByName(cdp, 'Previous', 'Previous (Roles → Compliance)');
    await waitFor(
      cdp,
      `document.querySelector(${JSON.stringify(SELECTOR.lockupCard)}) !== null`,
      'the Compliance step to render again for the rich fixture'
    );
    await waitForStable(cdp, SELECTOR.lockupCard, 'the Compliance step module catalog');
    await freezeAnimations(cdp);
  }
  await focusSelector(cdp, SELECTOR.lockupCard, 'the lockup module card (rich fixture)');
  await waitFor(
    cdp,
    `document.querySelectorAll('.rwa-code-preview-impact-file').length >= ${RICH_FIXTURE_MIN_GROUPS}`,
    `the rich fixture to render at least ${RICH_FIXTURE_MIN_GROUPS} file groups`
  );
}

/** Well-known Stellar account used only to seed the tall Addresses fixture. */
const TALL_FIXTURE_SEED_ADDRESS = 'GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH';

/** Advance to Roles and focus the tall fixture — `accessControl.roles[0].addresses`. */
async function focusTallFixture(cdp) {
  const alreadyThere = await evaluate(
    cdp,
    `document.querySelector(${JSON.stringify(SELECTOR.roleAddressInput)}) !== null`
  );
  if (alreadyThere !== true) {
    await clickButtonByName(cdp, 'Next', 'Next (Compliance → Roles)');
    await waitFor(
      cdp,
      `document.querySelector(${JSON.stringify(SELECTOR.roleAddressInput)}) !== null`,
      'the Roles step operator-role address field to render'
    );
    await waitForStable(cdp, SELECTOR.roleAddressInput, 'the Roles step address field');
    await freezeAnimations(cdp);
  }

  async function focusAndCount() {
    await focusSelector(cdp, SELECTOR.roleAddressInput, 'an operator-role address field (tall fixture)');
    // Impact binding is async after focusin; wait rather than sampling once.
    try {
      await waitFor(
        cdp,
        `document.querySelectorAll(${JSON.stringify(SELECTOR.columnRow)}).length >= ${TALL_FIXTURE_MIN_ROWS}`,
        `the tall fixture to render at least ${TALL_FIXTURE_MIN_ROWS} impact rows`,
        GENERATE_TIMEOUT_MS
      );
    } catch {
      /* counted below */
    }
    return await evaluate(
      cdp,
      `document.querySelectorAll(${JSON.stringify(SELECTOR.columnRow)}).length`
    );
  }

  let rowCount = await focusAndCount();
  if (typeof rowCount === 'number' && rowCount >= TALL_FIXTURE_MIN_ROWS) {
    return;
  }

  // Empty roles leave a pending Addresses path that can render blank after
  // quieter role-guard omit. Seed one valid member so generation attributes the
  // path, then re-focus.
  await typeInto(cdp, SELECTOR.roleAddressInput, TALL_FIXTURE_SEED_ADDRESS, 'tall fixture role address');
  await clickButtonByName(cdp, 'Add', 'Add tall fixture role address');
  await waitFor(
    cdp,
    `document.querySelectorAll(${JSON.stringify(SELECTOR.columnRow)}).length >= ${TALL_FIXTURE_MIN_ROWS} || document.querySelector('[data-impact-stale="true"]') !== null`,
    'preview to refresh after seeding the tall fixture address',
    GENERATE_TIMEOUT_MS
  ).catch(() => {});
  await waitFor(
    cdp,
    `document.querySelector('[data-impact-stale="true"]') === null`,
    'preview refresh after tall fixture seed to finish',
    GENERATE_TIMEOUT_MS
  ).catch(() => {});

  rowCount = await focusAndCount();
  if (typeof rowCount !== 'number' || rowCount < TALL_FIXTURE_MIN_ROWS) {
    throw new ProbeError(
      `the tall fixture rendered ${rowCount} rows, expected at least ${TALL_FIXTURE_MIN_ROWS} ` +
        `(accessControl.roles[0].addresses). SF-19 quieter Addresses may have lowered this — ` +
        're-measure TALL_FIXTURE_MIN_ROWS rather than hoping.'
    );
  }
}

/**
 * Show or hide the file tree, reading the tree's current state from the tree's
 * OWN control rather than from `data-tree-visible`.
 *
 * The stamp is the attribute this sub-feature adds, so driving from it would
 * make INV-15's assertion a tautology — the probe would set the state from the
 * thing it is about to check. `aria-pressed` on the toggle is the tree's
 * published state, it predates this work, and INV-44 pins that it stays
 * truthful at every width. The two are then compared as independent facts.
 */
async function setTreeVisible(cdp, visible) {
  const state = await evaluate(
    cdp,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-pressed]'));
      const toggle = buttons.find((b) => {
        const label = b.getAttribute('aria-label') || '';
        return label === ${JSON.stringify(SELECTOR_TREE_TOGGLE_SHOW)} || label === ${JSON.stringify(SELECTOR_TREE_TOGGLE_HIDE)};
      });
      if (toggle === undefined) return { found: false };
      return { found: true, pressed: toggle.getAttribute('aria-pressed') === 'true', label: toggle.getAttribute('aria-label') };
    })()`
  );
  if (state.found !== true) {
    throw new ProbeError(
      'the file tree toggle is not on the page; the drawer header did not render its tools'
    );
  }
  // `aria-pressed` is true when the tree is HIDDEN — the control is named for
  // its action, and INV-44 requires that reading to stay literally true.
  const treeVisible = !state.pressed;
  if (treeVisible === visible) return;

  await clickButtonByName(
    cdp,
    visible ? SELECTOR_TREE_TOGGLE_SHOW : SELECTOR_TREE_TOGGLE_HIDE,
    `the file tree toggle (${visible ? 'show' : 'hide'})`
  );
  await evaluate(cdp, 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
}

/* ========================================================================== */
/* The checks                                                                  */
/* ========================================================================== */

/**
 * V0 (INV-24), V1 (INV-25), V2 (INV-26) — measured together, per configuration,
 * because they read the same frame and splitting them would let three checks
 * disagree about what was on screen.
 */
async function checkGeometry(cdp, checks) {
  const v0 = new Check('V0', 'Containment is inert, asserted against derived geometry');
  const v1 = new Check('V1', `Code pane is never below ${CODE_PANE_FLOOR_PX}px in any configuration`);
  const v2 = new Check('V2', 'No configuration overflows');
  const stamp = new Check('INV-15', '`data-tree-visible` renders the literal the container query matches');

  for (const viewport of VIEWPORTS) {
    for (const treeVisible of [true, false]) {
      const label = `${viewport.label}/${treeVisible ? 'tree' : 'no-tree'}`;
      await setViewport(cdp, viewport.width, viewport.height);
      await setTreeVisible(cdp, treeVisible);
      await setViewport(cdp, viewport.width, viewport.height);

      const attr = await callInPage(cdp, readTreeVisibleStamp);
      stamp.expect(
        attr.raw === String(treeVisible),
        `${label}: data-tree-visible is ${JSON.stringify(attr.raw)}, expected the literal ` +
          `"${treeVisible}" — the container query matches on that exact value, so an empty ` +
          'string or an absent attribute stops the rule matching with nothing else observing it'
      );

      const geo = await callInPage(cdp, measureGeometry);

      // V1 — the claim this whole design exists to defend.
      v1.expect(
        geo.code >= CODE_PANE_FLOOR_PX,
        `${label}: code pane is ${geo.code}px, below the ${CODE_PANE_FLOOR_PX}px floor ` +
          `(container ${geo.container}, tree ${geo.tree}, column ${geo.column}, ` +
          `column ${geo.columnShown ? 'shown' : 'suppressed'})`
      );
      v1.note(`${label}: code pane ${geo.code}px, column ${geo.columnShown ? 'shown' : 'suppressed'}`);

      // V2 — exact equality, not a tolerance.
      v2.expect(
        geo.containerScrollWidth === geo.container,
        `${label}: .rwa-code-preview scrollWidth ${geo.containerScrollWidth} !== clientWidth ${geo.container}`
      );

      // V0 — the derived identity, which is the real containment test. Only
      // meaningful where the column is suppressed, which is the pre-change shape.
      if (!geo.columnShown) {
        const derived = geo.container - geo.tree;
        v0.expect(
          Math.abs(geo.code - derived) <= GEOMETRY_TOLERANCE_PX,
          `${label}: code pane is ${geo.code}px but container − tree is ${derived}px ` +
            `(${geo.container} − ${geo.tree}); \`container-type: inline-size\` on the flex row ` +
            'has disturbed the layout'
        );
        // Secondary floor, with its own message: re-baselining is the deliberate
        // response to this one, never to the derived identity above.
        const recorded = RECORDED_CODE_PANE_PX[label];
        if (recorded !== undefined && Math.abs(geo.code - recorded) > GEOMETRY_TOLERANCE_PX) {
          v0.note(
            `${label}: code pane ${geo.code}px vs the recorded ${recorded}px. The derived check ` +
              'above passed, so containment is still inert; this is kit chrome moving. ' +
              'Re-baseline RECORDED_CODE_PANE_PX deliberately.'
          );
        }
      }
    }
  }

  checks.push(v0, v1, v2, stamp);
}

/**
 * V3 (INV-27) — the threshold, derived from measured rails, with monotonicity
 * proven before the search runs.
 *
 * A binary search over a constant predicate converges on its own bound and
 * returns it as a switch point. Both endpoints are therefore asserted first,
 * and a constant predicate is an explicit failure naming the constancy — which
 * is what makes the self-check's forced failure a detection rather than an
 * arithmetic accident.
 */
async function checkThreshold(cdp, checks) {
  const v3 = new Check('V3', 'The threshold is derived from measured rails; the predicate is monotone');

  await setViewport(cdp, 1400, 900);
  await setTreeVisible(cdp, true);
  await setViewport(cdp, 1400, 900);

  const wide = await callInPage(cdp, measureGeometry);
  if (!wide.columnShown) {
    v3.fail(
      'at 1400px with the tree shown the column is suppressed, so the rails cannot be measured. ' +
        'Either the threshold is far above its derivation or the column is not mounted.'
    );
    checks.push(v3);
    return;
  }
  const measuredTree = wide.tree;
  const measuredColumn = wide.column;
  v3.note(`measured rails: tree ${measuredTree}px, column ${measuredColumn}px`);

  // The expected VIEWPORT switch point. The literal 1126 lives in the CSS and
  // in no assertion: if any of the three components moves, this moves with it.
  const expected = Math.round(
    measuredTree + measuredColumn + CODE_PANE_FLOOR_PX + DRAWER_BODY_INSET_PX
  );
  v3.note(
    `derived switch point = tree ${measuredTree} + column ${measuredColumn} + ` +
      `floor ${CODE_PANE_FLOOR_PX} + drawer inset ${DRAWER_BODY_INSET_PX} = ${expected}px viewport`
  );

  const low = 820;
  const high = 1400;
  const shownAtHigh = await probeVisibility(cdp, high);
  const shownAtLow = await probeVisibility(cdp, low);

  if (shownAtLow === shownAtHigh) {
    v3.fail(
      `the visibility predicate is CONSTANT over [${low}, ${high}] — the column is ` +
        `${shownAtLow ? 'shown' : 'suppressed'} at both endpoints. A binary search over a constant ` +
        'predicate converges on its own bound and reports it as a switch point, so the search is ' +
        'not run. There is no threshold to derive.'
    );
    checks.push(v3);
    return;
  }
  if (shownAtLow && !shownAtHigh) {
    v3.fail(
      `the visibility predicate is INVERTED: the column is shown at ${low}px and suppressed at ` +
        `${high}px. The rule is supposed to have one direction — the column yields as width shrinks.`
    );
    checks.push(v3);
    return;
  }

  // Monotone and non-constant: the search is now meaningful.
  let lo = low;
  let hi = high;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (await probeVisibility(cdp, mid)) hi = mid;
    else lo = mid;
  }

  v3.expect(
    hi === expected,
    `measured switch point is ${hi}px viewport, expected ${expected}px derived from the rails ` +
      `on the page (tree ${measuredTree} + column ${measuredColumn} + floor ${CODE_PANE_FLOOR_PX} ` +
      `+ inset ${DRAWER_BODY_INSET_PX}). The CSS threshold and its derivation have drifted apart.`
  );
  v3.note(`measured switch point: ${hi}px viewport (${hi - DRAWER_BODY_INSET_PX}px container)`);

  // The point of the whole number: at the switch point the code pane is exactly
  // the status-quo floor. Asserted here rather than inferred from the arithmetic.
  await setViewport(cdp, hi, 900);
  const atSwitch = await callInPage(cdp, measureGeometry);
  v3.expect(
    Math.abs(atSwitch.code - CODE_PANE_FLOOR_PX) <= GEOMETRY_TOLERANCE_PX,
    `at the switch point (${hi}px) the code pane is ${atSwitch.code}px, not the ` +
      `${CODE_PANE_FLOOR_PX}px status-quo floor the threshold is built from`
  );

  checks.push(v3);
}

async function probeVisibility(cdp, viewportWidth) {
  await setViewport(cdp, viewportWidth, 900);
  return callInPage(cdp, isColumnShown);
}

/** V4 (INV-28) — the column owns its scroll region and the sheet body never scrolls. */
async function checkScrollOwnership(cdp, checks) {
  const v4 = new Check('V4', 'The column owns its scroll region; the sheet body never scrolls');

  // Post-SF-19 the Addresses tall fixture is only 3 rows and no longer scrolls.
  // The rich (lockup module) fixture still fills the scroller.
  await focusRichFixture(cdp);

  for (const viewport of VIEWPORTS) {
    for (const treeVisible of [true, false]) {
      const label = `${viewport.label}/${treeVisible ? 'tree' : 'no-tree'}`;
      await setViewport(cdp, viewport.width, viewport.height);
      await setTreeVisible(cdp, treeVisible);
      await setViewport(cdp, viewport.width, viewport.height);

      if (!(await callInPage(cdp, isColumnShown))) continue;

      const scroll = await callInPage(cdp, measureColumnScroll, RICH_FIXTURE_MIN_GROUPS);
      v4.expect(
        scroll.scrollHeight > scroll.clientHeight,
        `${label}: the column's scroller does not scroll (${scroll.scrollHeight} <= ` +
          `${scroll.clientHeight}) with ${scroll.rows} rows rendered — the worst case is being clipped`
      );
      v4.expect(
        scroll.bodyScrollHeight === scroll.bodyClientHeight,
        `${label}: the sheet body scrolls (${scroll.bodyScrollHeight} !== ${scroll.bodyClientHeight}). ` +
          'The sticky heading now pins to the sheet rather than the column, and dragging the sheet ' +
          'shorter scrolls the code pane off screen.'
      );
      v4.note(`${label}: ${scroll.rows} rows, scroller ${scroll.scrollHeight}/${scroll.clientHeight}`);
    }
  }

  checks.push(v4);
}

/** V5 (INV-29) and V7 (INV-31) — sticky heading, and the long path's heading. */
async function checkHeadings(cdp, checks) {
  const v5 = new Check('V5', 'The file heading stays pinned at the scroller top');
  const v7 = new Check('V7', 'A long path heading does not overflow and its leaf is fully rendered');

  // Rich fixture: enough rows to scroll past a heading, and carries LONG_PATH.
  await setViewport(cdp, 1280, 900);
  await setTreeVisible(cdp, false);
  await setViewport(cdp, 1280, 900);
  await focusRichFixture(cdp);

  const sticky = await callInPage(cdp, measureStickyHeading, 200, STICKY_MIN_SCROLL_PX);
  v5.expect(
    Math.abs(sticky.delta) <= 1,
    `after scrolling ${sticky.scrollTop}px the pinned heading sits ${sticky.delta}px from the ` +
      'scroller top, not at 0 — `position: sticky` is resolving against the wrong ancestor'
  );
  v5.expect(
    sticky.opaque !== 'rgba(0, 0, 0, 0)' && sticky.opaque !== 'transparent',
    `the pinned heading's background is ${sticky.opaque}; rows scroll through it`
  );
  v5.note(`pinned at ${sticky.delta}px after scrolling ${sticky.scrollTop}px over ${sticky.headings} headings`);

  const heading = await callInPage(cdp, measureHeadingOverflow, LONG_PATH);
  v7.expect(
    heading.headingScrollWidth === heading.headingClientWidth,
    `the long path's heading overflows: scrollWidth ${heading.headingScrollWidth} !== ` +
      `clientWidth ${heading.headingClientWidth}`
  );
  v7.expect(
    heading.leafScrollWidth === heading.leafClientWidth,
    `the long path's leaf is truncated: scrollWidth ${heading.leafScrollWidth} !== ` +
      `clientWidth ${heading.leafClientWidth} for "${heading.leafText}". Five generated files are ` +
      'named contract.rs; the leaf is what tells them apart.'
  );
  v7.note(`leaf "${heading.leafText}" at ${heading.leafClientWidth}px`);

  checks.push(v5, v7);
}

/** V6 (INV-30) — the sheet's height floor has no special mode. */
async function checkHeightFloor(cdp, baseUrl, checks) {
  const v6 = new Check('V6', 'The sheet height floor has no special mode');

  await prepareApp(cdp, baseUrl, { heightPx: SHEET_FLOOR_PX, treeVisible: false });
  await focusRichFixture(cdp);
  await setViewport(cdp, 900, 700);

  if (!(await callInPage(cdp, isColumnShown))) {
    v6.fail('the column is suppressed at 900x700 with the tree hidden, where the rule requires it shown');
    checks.push(v6);
    return;
  }

  const floor = await callInPage(cdp, measureHeightFloor);
  v6.expect(
    floor.headerText.length > 0,
    'at the height floor the column header renders no field name — the one thing worth guaranteeing at 36px'
  );
  v6.expect(
    floor.headerBottom <= floor.columnBottom + 1,
    `the header (bottom ${floor.headerBottom}) clips out of the column (bottom ${floor.columnBottom}) at the floor`
  );
  v6.expect(!floor.rowOverflows, 'the three-region row overflows horizontally at the height floor');
  v6.expect(!floor.columnOverflows, 'the column overflows horizontally at the height floor');
  v6.expect(
    !floor.bodyScrolls,
    'the sheet body scrolls at the height floor — the scroller is not collapsing, so something ' +
      'has a minimum height'
  );
  v6.expect(
    floor.scrollerHeight >= 0,
    `the column scroller measured a negative height (${floor.scrollerHeight}) at the floor`
  );
  v6.note(
    `row ${floor.rowHeight}px, scroller ${floor.scrollerHeight}px, header "${floor.headerText}"`
  );

  checks.push(v6);
}

/**
 * V8, second leg — a row activated **while a refresh is in flight** still lands.
 *
 * This is the case that produced a silent no-op once the rows began surviving a
 * refresh: a reveal issued in that window is stamped with the on-screen tree's
 * generate key and dropped when the newer tree arrives, so the row looked live
 * and did nothing. The column now finishes the action against the tree that
 * actually lands.
 *
 * **Driven into the window rather than hoping to land in it.** The first leg
 * clicks whenever the fixture happens to be — which was `refreshing=false` on
 * the run that first went green here, making it no regression guard at all.
 * This one types a character and clicks on the next round trip, inside the
 * debounce, and **fails closed if the column was not actually refreshing**: a
 * leg that cannot tell whether it exercised anything is worse than no leg.
 */
async function checkRevealDuringRefresh(cdp, baseUrl, v8) {
  // A fresh page, deliberately: the first leg leaves ~96 marks standing, and
  // clearing them in-page means either racing React's flush or finding a row in
  // another file. A reload clears every reveal. SF-21 then auto-selects on
  // focus, so the post-focus baseline may be non-zero again — that is AS-1,
  // not pollution. This leg's proof is stale-at-click + marks still present
  // after the new tree lands (INV-19 / SF-13 defer), not a zero mark count.
  await prepareApp(cdp, baseUrl, { heightPx: 400, treeVisible: false });
  // The same warm-up leg 1 uses: it is what proves the column is live and
  // populated before anything is asked of it.
  await focusRichFixture(cdp);
  await setViewport(cdp, 900, 700);

  await focusSelector(cdp, SELECTOR.lockupField, 'the lockup config field (refresh leg)');
  await waitFor(
    cdp,
    `document.querySelectorAll(${JSON.stringify(SELECTOR.columnRow)}).length > 0`,
    'the lockup config field to produce column rows'
  );

  // SF-21 auto-select: with the drawer open, focusing a ranged field activates
  // the first ranged site — the same action as clicking that row — so marks may
  // already be non-zero on a freshly loaded page. That is product behaviour
  // (AS-1), not probe pollution. Tolerate it; the refresh-leg proof is the
  // stale-at-click non-vacuity below, not a zero baseline.
  // (SF-20 Finding 1 → SF-21 Tests.)
  const baseline = await evaluate(
    cdp,
    `document.querySelectorAll('.rwa-code-preview-code mark[data-code-view-reveal]').length`
  );
  v8.note(
    `refresh leg baseline marks after focus: ${baseline}` +
      (baseline === 0 ? '' : ' (SF-21 auto-select; zero no longer required)')
  );

  // One real keystroke: Input.dispatchKeyEvent, because the wizard's fields are
  // react-hook-form controlled and a synthetic value assignment does not reach them.
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    text: '0',
    unmodifiedText: '0',
    key: '0',
  });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: '0' });

  // Next round trip — inside the regeneration debounce by a wide margin.
  const clicked = await evaluate(
    cdp,
    `(() => {
      const column = document.querySelector('.rwa-code-preview-impact');
      const rows = Array.from(document.querySelectorAll(${JSON.stringify(SELECTOR.columnRow)}));
      const ranged = rows.filter((row) => Number(row.getAttribute('data-row-span') || '0') > 0);
      if (ranged.length === 0) return { ok: false, rows: rows.length };
      const stale = column === null ? null : column.getAttribute('data-impact-stale');
      ranged[0].click();
      return { ok: true, stale, rows: rows.length, label: ranged[0].getAttribute('aria-label') };
    })()`
  );

  if (clicked.ok !== true) {
    v8.fail(
      `no ranged column rows survived the keystroke (rows=${clicked.rows}) — nothing to activate`
    );
    return;
  }

  // Non-vacuity, asserted by name: if the column was not refreshing at the click,
  // this leg exercised the ordinary path and proved nothing about the in-flight one.
  if (clicked.stale !== 'true') {
    v8.fail(
      `the refresh leg clicked while data-impact-stale=${JSON.stringify(clicked.stale)} — ` +
        'the regeneration had already landed, so the in-flight case went untested'
    );
    return;
  }

  await waitFor(
    cdp,
    `document.querySelector('.rwa-code-preview-code mark[data-code-view-reveal]') !== null`,
    'a row activated during a refresh to mark a range once the new tree lands',
    REVEAL_TIMEOUT_MS
  ).catch(() => {});

  const marks = await evaluate(
    cdp,
    `document.querySelectorAll('.rwa-code-preview-code mark[data-code-view-reveal]').length`
  );

  v8.note(
    `refresh leg: activated ${JSON.stringify(clicked.label)} with data-impact-stale=true; ` +
      `marks ${baseline} → ${marks} once the new tree landed`
  );

  v8.expect(
    marks > 0,
    'a row activated while the column was refreshing produced no mark at all — the reveal was ' +
      'issued against the tree on screen and discarded when the newer tree arrived, so the click ' +
      'was a silent no-op'
  );
}

/** V8 (INV-45) — reveal from a column row lands visibly at the narrow pane. */
async function checkRevealAtNarrowPane(cdp, baseUrl, checks) {
  const v8 = new Check('V8', 'Reveal from a column row lands visibly at the narrow pane');

  await prepareApp(cdp, baseUrl, { heightPx: 400, treeVisible: false });
  await focusRichFixture(cdp);
  await setViewport(cdp, 900, 700);

  // The widest range in the rich fixture is the 34-line one; take the row with
  // the largest span so the check measures the case that actually degrades.
  const activated = await evaluate(
    cdp,
    `(() => {
      const rows = Array.from(document.querySelectorAll('.rwa-code-preview-impact-row'));
      let best = null;
      let bestSpan = -1;
      for (const row of rows) {
        const span = Number(row.getAttribute('data-row-span') || '0');
        if (span > bestSpan) { bestSpan = span; best = row; }
      }
      if (best === null) return { ok: false };
      const column = document.querySelector('.rwa-code-preview-impact');
      const stale = column === null ? null : column.getAttribute('data-impact-stale');
      best.click();
      return { ok: true, span: bestSpan, stale, rows: rows.length };
    })()`
  );
  if (activated.ok !== true) {
    v8.fail('no column rows were present to activate at 900x700');
    checks.push(v8);
    return;
  }
  v8.note(
    `activated a row spanning ${activated.span} lines ` +
      `(rows=${activated.rows}, refreshing=${activated.stale})`
  );

  // Wait for the mark, rather than sleeping and hoping.
  //
  // This is the check that found the dead click: the rows now survive a
  // refresh, so this click can land while a newer tree is in flight, and a
  // range sent in that window is discarded when the tree arrives. The column
  // answers by re-issuing the range against the tree that actually lands — so
  // the mark's arrival is an EVENT, not a fixed latency, and a blind `sleep`
  // either flakes or hides it.
  //
  // The wait is not a way to pass: it is bounded, and on timeout the check
  // below still fails closed naming the missing mark, exactly as before.
  await waitFor(
    cdp,
    `document.querySelector('.rwa-code-preview-code mark[data-code-view-reveal]') !== null`,
    'the activated row to mark a range in the code pane',
    REVEAL_TIMEOUT_MS
  ).catch(() => {});

  const reveal = await callInPage(cdp, measureRevealVisibility);
  v8.expect(
    reveal.inside,
    `the marked range's first line is at ${reveal.markTop}, outside the pane's visible box ` +
      `[${reveal.paneTop}, ${reveal.paneBottom}]. Reveal geometry is the kit's — this check ` +
      'verifies degradation, it does not fix it.'
  );

  await checkRevealDuringRefresh(cdp, baseUrl, v8);
  checks.push(v8);
}

/**
 * SF-23 — wizard dock menu (bottom + left); assert side attrs, tools operable,
 * and layer pointer-events (INV-3 / INV-10 / INV-12 / INV-13).
 * Product (`dockLayout.ts`): bottom uses kit inset (host publishes side + inset);
 * left stays overlay (no host side/inset attrs). Edge placement geometry stays
 * out of happy-dom and is probe-owned (INV-24). Top/right remain in the set API
 * but are not offered in the wizard menu.
 */
async function checkDockCycle(cdp, checks) {
  const check = new Check(
    'SF23-DOCK',
    'Dock menu sets bottom/left; tools operable; layer pointer-events none'
  );
  const geo = new Check(
    'SF23-DOCK-GEO',
    'Desktop: bottom inset + left overlay; code readable on both'
  );

  await setViewport(cdp, 1280, 900);

  const menuLabels = await listDockMenuLabels(cdp);
  check.expect(
    menuLabels.includes('Dock preview to bottom') && menuLabels.includes('Dock preview to left'),
    `wizard dock menu lists bottom + left, got ${JSON.stringify(menuLabels)}`
  );
  check.expect(
    !menuLabels.includes('Dock preview to top') && !menuLabels.includes('Dock preview to right'),
    `wizard dock menu must not offer top/right, got ${JSON.stringify(menuLabels)}`
  );

  let chrome = await callInPage(cdp, measureDockChrome);
  check.expect(chrome.previewPresent, 'preview row present before dock menu');
  check.expect(chrome.dataSide === 'bottom', `initial data-side is bottom, got ${chrome.dataSide}`);
  check.expect(
    chrome.sideAttr === 'bottom',
    `bottom inset: html publishes data-bottom-sheet-side=bottom, got ${chrome.sideAttr}`
  );
  check.expect(chrome.toolsOperable, 'tools operable on bottom dock');
  check.expect(
    chrome.layerPointerEvents === 'none',
    `bottom-sheet layer pointer-events is none, got ${chrome.layerPointerEvents}`
  );
  check.expect(
    chrome.closeToolsDeltaY === 0,
    `bottom: Close midY must match tools (closeToolsDeltaY=${chrome.closeToolsDeltaY})`
  );
  check.expect(
    chrome.closeHeight === chrome.toolHeight,
    `bottom: Close height ${chrome.closeHeight} must match tools ${chrome.toolHeight}`
  );

  const geoSides = ['bottom', 'left'];
  for (const side of geoSides) {
    if (side !== 'bottom') {
      await setDockViaMenu(cdp, side, `dock menu → ${side}`);
      chrome = await callInPage(cdp, measureDockChrome);
      check.expect(
        chrome.dataSide === side,
        `after menu pick, data-side is ${side}, got ${chrome.dataSide}`
      );
      check.expect(
        chrome.sideAttr === null || chrome.sideAttr === '',
        `overlay: after menu to ${side}, no html side attr, got ${chrome.sideAttr}`
      );
      check.expect(chrome.toolsOperable, `tools operable on ${side} dock`);
      check.expect(
        chrome.layerPointerEvents === 'none',
        `layer pointer-events none on ${side}, got ${chrome.layerPointerEvents}`
      );
      check.expect(chrome.previewPresent, `preview still present on ${side}`);
      check.expect(
        chrome.closeToolsDeltaY === 0,
        `${side}: Close midY must match tools (closeToolsDeltaY=${chrome.closeToolsDeltaY})`
      );
      check.expect(
        chrome.closeHeight === chrome.toolHeight,
        `${side}: Close height ${chrome.closeHeight} must match tools ${chrome.toolHeight}`
      );
    }

    const geometry = await callInPage(cdp, measureDockGeometry);
    geo.expect(
      geometry.codeReadable,
      `code pane readable on ${side} dock (w=${geometry.sheet.width}, h=${geometry.sheet.height})`
    );
    if (side === 'bottom') {
      geo.expect(
        geometry.insetAttr === true,
        `desktop bottom inset must publish inset (got insetAttr=${geometry.insetAttr})`
      );
    } else {
      geo.expect(
        geometry.insetAttr === false,
        `desktop ${side} overlay must not publish inset (got insetAttr=${geometry.insetAttr})`
      );
    }
  }

  // Return to bottom so later stages see the default dock.
  await setDockViaMenu(cdp, 'bottom', 'dock menu left → bottom');
  chrome = await callInPage(cdp, measureDockChrome);
  check.expect(chrome.dataSide === 'bottom', `menu restored bottom, got ${chrome.dataSide}`);

  checks.push(check);
  checks.push(geo);
}

/**
 * SF-23 — narrow horizontal overlay (<480) and short-viewport overlay (INV-11 / INV-12 / INV-26).
 * Wizard menu offers left (not right/top); asserts overlay, layer PE none, form reachability.
 */
async function checkDockNarrow(cdp, checks) {
  const check = new Check(
    'SF23-DOCK-NARROW',
    'Narrow side docks use overlay; layer never traps the form (INV-11/12/26)'
  );

  // Ensure we start from bottom at a desktop size, then shrink.
  await setViewport(cdp, 1280, 900);
  let chrome = await callInPage(cdp, measureDockChrome);
  if (chrome.dataSide !== 'bottom') {
    await setDockViaMenu(cdp, 'bottom', `reset dock to bottom from ${chrome.dataSide}`);
    chrome = await callInPage(cdp, measureDockChrome);
  }

  await setDockViaMenu(cdp, 'left', 'dock menu bottom → left');
  await setViewport(cdp, 400, 700);
  await sleep(200);

  chrome = await callInPage(cdp, measureDockChrome);
  check.expect(chrome.dataSide === 'left', `narrow: dock stays left, got ${chrome.dataSide}`);
  check.expect(
    chrome.sideAttr === null || chrome.sideAttr === '',
    `INV-11: narrow side dock must not publish inset side attr, got ${chrome.sideAttr}`
  );
  check.expect(
    chrome.layerPointerEvents === 'none',
    `INV-12: layer pointer-events none on narrow left, got ${chrome.layerPointerEvents}`
  );
  check.expect(chrome.toolsOperable, 'tools operable on narrow left overlay');

  const reach = await callInPage(cdp, measureOverlayFormReachability);
  check.expect(
    reach.insetPublished === false,
    `INV-11: narrow overlay must not publish data-bottom-sheet-inset, got ${reach.insetPublished}`
  );
  if (reach.formOutsideSheet) {
    check.expect(
      reach.hitInsideSheet === false,
      'INV-12: when the form control sits outside the sheet box, elementFromPoint must not land in the sheet'
    );
  } else {
    // Overlay may cover the focused field; the trap to forbid is a full-viewport
    // pointer-events layer, already asserted via layerPointerEvents === 'none'.
    check.expect(
      reach.layerPointerEvents === 'none',
      'INV-12: overlay covering the form still keeps the layer pointer-events none'
    );
  }

  // Short-viewport overlay courtesy (INV-26) — left remains offered in the wizard menu.
  await setViewport(cdp, 1280, 280);
  await sleep(200);
  chrome = await callInPage(cdp, measureDockChrome);
  check.expect(chrome.dataSide === 'left', `short viewport: dock stays left, got ${chrome.dataSide}`);
  check.expect(
    chrome.sideAttr === null || chrome.sideAttr === '',
    `INV-26: short side dock uses overlay (no side attr), got ${chrome.sideAttr}`
  );
  check.expect(chrome.toolsOperable, 'tools operable on short left overlay');
  check.expect(
    chrome.layerPointerEvents === 'none',
    `layer pointer-events none on short left, got ${chrome.layerPointerEvents}`
  );

  // Restore a desktop bottom dock for any subsequent work.
  await setViewport(cdp, 1280, 900);
  await sleep(200);
  await setDockViaMenu(cdp, 'bottom', 'restore bottom from left');
  chrome = await callInPage(cdp, measureDockChrome);
  check.expect(chrome.dataSide === 'bottom', `restored bottom, got ${chrome.dataSide}`);

  checks.push(check);
}

/**
 * V11 (SC-017 / SF-20) — the tree/code join is opaque end to end.
 *
 * Pass 1 checked only computed gutter backgroundColor — vacuous when scrolled
 * `<code>` paints *over* a solid sticky gutter (gap-ring-still-transparent).
 * Rev 2 oracle: z-index ≥ 1, pre isolation + left pad/border reclaim, and a
 * CDP pixel band through the gutter's padding strip while still scrolled.
 */
async function checkOpaqueJoin(cdp, checks) {
  const v11 = new Check(
    'V11',
    'SC-017: tree/code join opaque under scroll (z-index + pixel band)'
  );

  await setViewport(cdp, 1280, 900);
  await setTreeVisible(cdp, true);
  await setViewport(cdp, 1280, 900);

  let join;
  try {
    join = await callInPage(cdp, measureOpaqueJoin);

    v11.expect(
      !join.gutterTransparent,
      `gutter background is transparent (${join.gutterBg}) — necessary but not sufficient for SC-017`
    );
    v11.expect(
      join.gutterBg === join.expectedEditor,
      `gutter background is ${join.gutterBg}, expected the editor token resolved to ${join.expectedEditor}`
    );
    v11.expect(
      join.paneBg === join.expectedEditor,
      `code pane background is ${join.paneBg}, expected ${join.expectedEditor}`
    );
    v11.expect(
      join.slotBg === join.expectedSidebar,
      `tree slot background is ${join.slotBg}, expected the sidebar token ${join.expectedSidebar}`
    );
    v11.expect(
      join.paneOverflow === 'hidden',
      `code pane overflow is "${join.paneOverflow}", expected "hidden" so paint cannot escape under the tree`
    );
    v11.expect(
      join.paneBorderLeftWidth === '1px',
      `code pane border-left is ${join.paneBorderLeftWidth}, expected 1px (separator on the code side)`
    );
    v11.expect(
      join.treeBorderRightWidth === '0px',
      `tree slot border-right is ${join.treeBorderRightWidth}; a tree-side border would shrink the 280px rail`
    );
    v11.expect(
      Math.abs(join.treeWidth - TREE_RAIL_PX) <= GEOMETRY_TOLERANCE_PX,
      `tree rail is ${join.treeWidth}px, expected ${TREE_RAIL_PX}px (±${GEOMETRY_TOLERANCE_PX}) — SF-13 V3 identity`
    );
    v11.expect(
      !join.gutterTransparentAfterScroll,
      `gutter background became transparent after horizontal scroll (${join.gutterBgAfterScroll})`
    );
    v11.expect(
      join.gutterBgAfterScroll === join.expectedEditor,
      `gutter after scroll is ${join.gutterBgAfterScroll}, expected ${join.expectedEditor}`
    );
    v11.expect(
      join.joinGapPx >= -GEOMETRY_TOLERANCE_PX,
      `gutter left is ${join.joinGapPx}px left of the tree's right edge — sticky content under the rail`
    );

    // Rev 2 paint-order contracts — backgroundColor alone was the vacuous pass.
    v11.expect(
      join.gutterZIndex >= 1,
      `gutter z-index is ${join.gutterZIndex} (computed ${JSON.stringify(join.gutterZIndex)}); ` +
        'need ≥ 1 so scrolled <code> cannot paint over the sticky gutter (gap-ring-still)'
    );
    v11.expect(
      join.preIsolation === 'isolate',
      `code pre isolation is "${join.preIsolation}", expected "isolate" (stacking context for gutter z-index)`
    );
    v11.expect(
      join.prePaddingLeft === '0px',
      `code pre padding-left is ${join.prePaddingLeft}, expected 0 — kit left pad was the glyph hole left of the gutter`
    );
    v11.expect(
      join.preBorderLeftWidth === '0px',
      `code pre border-left-width is ${join.preBorderLeftWidth}, expected 0`
    );
    v11.expect(
      parseFloat(join.gutterPaddingLeft) > 0,
      `gutter padding-left is ${join.gutterPaddingLeft}; rev 2 reclaim should keep number inset on the gutter`
    );

    // Paint-order: scrolled source must not sit above the sticky gutter in hit-testing.
    v11.expect(
      join.hitTest.topIsGutter === true,
      `elementsFromPoint(${join.hitTest.x.toFixed(1)},${join.hitTest.y.toFixed(1)}) top is ` +
        `<${join.hitTest.topTag} class="${join.hitTest.topClass}">, not the gutter — ` +
        'scrolled <code> is painting over the sticky gutter (gap-ring-still)'
    );
    v11.expect(
      join.hitTest.codeAboveGutter === false,
      'a code/hljs node is hit-tested above the gutter after horizontal scroll (gap-ring-still)'
    );

    const band = join.pixelBand;
    if (!(band.width > 0) || !(band.height > 0)) {
      v11.fail(`pixel band degenerated to ${band.width}×${band.height} — cannot assert glyph-over-gutter`);
    } else {
      // Full viewport shot — clipped captures were landing on white page chrome
      // despite in-viewport CSS rects (CDP clip vs layout-viewport mismatch inside
      // the sheet). Sample the hit-test locus out of the full image instead.
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
      });
      const png = Buffer.from(shot.data, 'base64');
      const { width, height, rgba } = decodePngRgba(png);
      const sample = sampleRgbaRect(
        rgba,
        width,
        height,
        Math.floor(join.hitTest.x - 2),
        Math.floor(join.hitTest.y - 4),
        8,
        Math.max(8, Math.min(20, Math.floor(join.gutterRect.height) || 20))
      );
      const analysis = analyseGutterBand(sample.rgba, sample.width, sample.height, {
        editor: join.editorRgb,
        gutterFg: join.gutterFgRgb,
        sidebar: join.sidebarRgb,
        border: join.borderRgb,
      });
      const hitGutter = analysis.nearNeutral / Math.max(1, analysis.total) >= 0.5;
      v11.note(
        `pixel sample at (${join.hitTest.x.toFixed(0)},${join.hitTest.y.toFixed(0)}) ` +
          `from ${width}×${height} viewport; nearNeutral=${analysis.nearNeutral}/${analysis.total} ` +
          `white=${analysis.white} hitGutter=${hitGutter}; gutterRect=(${join.gutterRect.left.toFixed(0)},${join.gutterRect.top.toFixed(0)})`
      );
      if (!hitGutter) {
        v11.fail(
          `pixel sample missed the gutter pad (nearNeutral ${analysis.nearNeutral}/${analysis.total}, ` +
            `white=${analysis.white}) — cannot certify SC-017 chroma; hit-test/z-index still apply`
        );
      } else {
        v11.expect(
          analysis.offenders.length === 0,
          `SC-017 pixel sample has ${analysis.offenders.length} non-neutral pixels after scroll — ` +
            `glyphs over sticky gutter (gap-ring-still). First: ${analysis.offenders[0] ?? '(none)'}`
        );
      }
    }

    v11.note(
      `gutter z=${join.gutterZIndex}; isolation=${join.preIsolation}; ` +
        `pre pad/border L=${join.prePaddingLeft}/${join.preBorderLeftWidth}; ` +
        `tree ${join.treeWidth}px; join gap ${join.joinGapPx}px; scrolled ${join.scrollLeft}px`
    );
  } finally {
    await callInPage(cdp, cleanupOpaqueJoin).catch(() => {});
  }

  checks.push(v11);
}

/**
 * Minimal PNG → RGBA decoder (8-bit RGB/RGBA only). Zero deps beyond node:zlib —
 * matches the probe's no-lockfile-change rule.
 */
function decodePngRgba(pngBuffer) {
  if (pngBuffer.length < 8 || pngBuffer[0] !== 0x89 || pngBuffer[1] !== 0x50) {
    throw new ProbeError('V11 screenshot was not a PNG');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  const idats = [];
  while (offset + 8 <= pngBuffer.length) {
    const len = pngBuffer.readUInt32BE(offset);
    const type = pngBuffer.toString('ascii', offset + 4, offset + 8);
    const data = pngBuffer.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new ProbeError(`V11 unsupported PNG bitDepth=${bitDepth} colorType=${colorType}`);
  }
  const raw = inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const rgba = new Uint8Array(width * height * 4);
  let src = 0;
  let prev = new Uint8Array(stride);

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  for (let y = 0; y < height; y += 1) {
    const filter = raw[src];
    src += 1;
    const recon = new Uint8Array(stride);
    for (let i = 0; i < stride; i += 1) {
      const x = raw[src + i];
      const a = i >= bpp ? recon[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let val;
      if (filter === 0) val = x;
      else if (filter === 1) val = (x + a) & 255;
      else if (filter === 2) val = (x + b) & 255;
      else if (filter === 3) val = (x + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) val = (x + paeth(a, b, c)) & 255;
      else throw new ProbeError(`V11 PNG bad filter byte ${filter}`);
      recon[i] = val;
    }
    src += stride;
    for (let x = 0; x < width; x += 1) {
      const si = x * bpp;
      const di = (y * width + x) * 4;
      rgba[di] = recon[si];
      rgba[di + 1] = recon[si + 1];
      rgba[di + 2] = recon[si + 2];
      rgba[di + 3] = bpp === 4 ? recon[si + 3] : 255;
    }
    prev = recon;
  }
  return { width, height, rgba };
}

function rgbDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Crop a CSS-pixel rectangle out of a full-viewport RGBA buffer. */
function sampleRgbaRect(rgba, imgW, imgH, x0, y0, w, h) {
  const left = Math.max(0, Math.min(imgW - 1, x0));
  const top = Math.max(0, Math.min(imgH - 1, y0));
  const width = Math.max(1, Math.min(w, imgW - left));
  const height = Math.max(1, Math.min(h, imgH - top));
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const si = ((top + y) * imgW + (left + x)) * 4;
      const di = (y * width + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return { rgba: out, width, height, left, top };
}

/**
 * Classify gutter-pad pixels. Near-white counts separately so a mis-aimed clip
 * (sampling light page chrome) fails with a diagnostic, not a silent glyph claim.
 */
function analyseGutterBand(rgba, width, height, palette) {
  const allowed = [palette.editor, palette.gutterFg, palette.sidebar, palette.border].filter(
    (c) => c !== null && c !== undefined
  );
  const offenders = [];
  let nearNeutral = 0;
  let white = 0;
  const total = width * height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const pixel = { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] };
      if (pixel.r >= 250 && pixel.g >= 250 && pixel.b >= 250) white += 1;
      const ok = allowed.some((c) => rgbDistance(pixel, c) <= GUTTER_BAND_RGB_TOLERANCE);
      if (ok) {
        nearNeutral += 1;
        continue;
      }
      if (offenders.length < 5) {
        const distances = allowed.map((c) => rgbDistance(pixel, c).toFixed(1)).join('/');
        offenders.push(`(${x},${y}) rgb(${pixel.r},${pixel.g},${pixel.b}) d=[${distances}]`);
      }
    }
  }
  // If the clip is mostly page chrome, the band missed the gutter — fail closed naming that.
  if (white > total * 0.5) {
    offenders.unshift(
      `clip is ${((white / total) * 100).toFixed(0)}% near-white — band missed the dark gutter pad`
    );
  }
  return { offenders, nearNeutral, white, total };
}

function findGutterBandOffenders(rgba, width, height, palette) {
  return analyseGutterBand(rgba, width, height, palette).offenders;
}

/**
 * V10 — SF-12's deferred verification, discharged here because a real browser is
 * the only place it can be shown.
 *
 * Two claims SF-12's unit suite cannot make: that `focusin` and `focusout`
 * genuinely fire on the real page the way its hook assumes, and that every
 * control its enumeration collects is genuinely reachable with Tab. The gap this
 * closes is between "the enumeration found N anchored controls" and "a user can
 * actually reach them" — happy-dom lets you focus anything, a real engine does
 * not. A failure here is SF-12's property, not SF-13's, and the messages say so.
 *
 * Runs with the drawer CLOSED so the walk covers the step form; the column's own
 * reachability is V9's.
 */
async function checkFocusReachability(cdp, checks) {
  const v10 = new Check(
    'V10',
    'SF-12: focusin/focusout fire, and every anchored control is Tab-reachable'
  );

  await clickButtonByName(cdp, 'Hide generated code', 'the code preview trigger (close)');
  await setViewport(cdp, 1280, 900);

  const inventory = await callInPage(cdp, installFocusInstrumentation);
  v10.note(`${inventory.total} anchored controls on this step`);

  await evaluate(cdp, '(() => { document.body.focus(); return true; })()');

  const budget = inventory.total * 8 + 80;
  let seen = 0;
  for (let press = 0; press < budget; press += 1) {
    await pressKey(cdp, 'Tab', 9);
    const state = await callInPage(cdp, readFocusInstrumentation, false);
    seen = state.reached;
    if (seen === inventory.total) break;
  }

  const result = await callInPage(cdp, readFocusInstrumentation, true);

  v10.expect(
    result.focusInEvents > 0,
    'no `focusin` events fired across the whole Tab walk. SF-12 hangs its entire resolution on ' +
      '`focusin`/`focusout`; if they do not fire here, nothing it publishes ever updates.'
  );
  v10.expect(
    result.focusOutEvents > 0,
    'no `focusout` events fired across the whole Tab walk, so SF-12 never sees focus leave a control.'
  );
  v10.expect(
    result.missed.length === 0,
    `${result.missed.length} of ${result.total} anchored controls were never reached by Tab in ` +
      `${budget} presses: ${result.missed.slice(0, 12).join(', ')}` +
      `${result.missed.length > 12 ? ', …' : ''}. SF-12's enumeration counts a control it can ` +
      'resolve; this asserts a user can actually get to it.'
  );
  v10.note(
    `reached ${seen}/${inventory.total}; ${result.focusInEvents} focusin, ${result.focusOutEvents} focusout`
  );

  checks.push(v10);

  // Reopen for the checks that follow.
  await clickButtonByName(cdp, 'View generated code', 'the code preview trigger (reopen)');
  await waitFor(
    cdp,
    `document.querySelector(${JSON.stringify(SELECTOR.previewRow)}) !== null`,
    'the preview drawer to re-render the three-region row after V10 closed it',
    GENERATE_TIMEOUT_MS
  );
  await freezeAnimations(cdp);
  if (SELF_CHECK) await injectSelfCheckStylesheet(cdp);
}

/**
 * V9 (INV-44) — Tab reaches the column when shown and skips it entirely when
 * suppressed, with focus asserted explicitly rather than trusted.
 *
 * The walk starts from a known element INSIDE the sheet (the tree toggle in its
 * header) rather than from the top of the page. Starting from the form means
 * spending the budget on ten address fields before the drawer is even reached,
 * and "Tab never got to the column" would then be true for the wrong reason.
 */
async function checkTabOrder(cdp, checks) {
  const v9 = new Check('V9', 'Tab reaches the column when shown and skips it when suppressed');

  // --- shown: 1280x900 with the tree hidden ---
  await setViewport(cdp, 1280, 900);
  await setTreeVisible(cdp, false);
  await setViewport(cdp, 1280, 900);
  await focusTallFixture(cdp);

  const shownState = await callInPage(cdp, describeFocus);
  v9.expect(
    shownState.hasFocus,
    'document.hasFocus() is false — Emulation.setFocusEmulationEnabled did not take, and every ' +
      'focus assertion below would be a test of nothing'
  );
  v9.expect(shownState.columnShown, 'the column is suppressed at 1280x900 with the tree hidden');

  const shown = await tabFromDrawerHeader(cdp, 80);
  if (shown.atRow !== null) {
    v9.note(
      `shown-leg, column state while focus was in the code pane: shown=${shown.atRow.shown} ` +
        `rows=${shown.atRow.rows} disabled=${shown.atRow.disabledRows} ` +
        `header="${shown.atRow.fieldHeader}" text="${shown.atRow.restingText}"`
    );
  }
  v9.expect(
    shown.reachedColumn,
    `Tab did not reach the column within ${shown.presses} presses while it was shown ` +
      `(entered the three-region row: ${shown.everInRow}). Walk: ${shown.trace.slice(0, 14).join(' -> ')}`
  );
  v9.note(`shown: reached the column after ${shown.presses} Tab presses`);

  // Reaching the region is not the property. INV-42's claim is that every ROW
  // is reachable and activatable, and the single tab stop on the root only
  // delivers that if landing on it arms the latch and repopulates the rows. One
  // more Tab, asserted — otherwise "the column is reachable" would be satisfied
  // by an empty region nobody can do anything in, which is exactly the state
  // the walk passes through one stop earlier.
  if (shown.reachedColumn) {
    const atRoot = await callInPage(cdp, describeFocus);
    v9.expect(
      atRoot.columnRows > 0,
      'landing on the column root did not repopulate its rows — the latch was not armed by the ' +
        `focus arrival, so the tab stop reaches an empty region (rows=${atRoot.columnRows})`
    );
    await pressKey(cdp, 'Tab', 9);
    const atRow = await callInPage(cdp, describeFocus);
    v9.expect(
      atRow.onColumnRow,
      'the Tab after the column root did not land on a row button; focus went to ' +
        `<${atRow.tag}> instead (inside the column: ${atRow.insideColumn}). The column is a tab ` +
        'stop but its rows are still not reachable, which is the half of INV-42 that matters.'
    );
    v9.note(
      `landing on the root repopulated ${atRoot.columnRows} rows; the next Tab reached a row button`
    );
  }

  // --- suppressed: 900x700 with the tree shown ---
  await setViewport(cdp, 900, 700);
  await setTreeVisible(cdp, true);
  await setViewport(cdp, 900, 700);
  await focusTallFixture(cdp);

  const suppressedState = await callInPage(cdp, describeFocus);
  v9.expect(
    !suppressedState.columnShown,
    'the column is shown at 900x700 with the tree shown, where the rule requires it suppressed'
  );

  const suppressed = await tabFromDrawerHeader(cdp, 160);
  // Non-vacuity: "never reached the column" is trivially true of a walk that
  // never went near the three-region row, so the walk must be shown to have
  // travelled through it before its negative result means anything.
  v9.expect(
    suppressed.everInRow,
    'the Tab walk never entered the three-region row while the column was suppressed, so ' +
      '"Tab skipped the column" would be true for the wrong reason'
  );
  v9.expect(
    !suppressed.reachedColumn,
    `Tab reached a control inside the column while it was suppressed (${suppressed.last}). ` +
      '`display: none` should have removed it from the tab order; a `visibility: hidden` or ' +
      'width-0 implementation leaves invisible buttons in the tab order.'
  );
  v9.note(`suppressed: ${suppressed.presses} Tab presses, entered the row: ${suppressed.everInRow}`);

  checks.push(v9);
}

/**
 * Tab forward from the drawer header, reporting whether focus ever entered the
 * column and whether it ever entered the three-region row at all.
 */
async function tabFromDrawerHeader(cdp, maxPresses) {
  const started = await evaluate(
    cdp,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-pressed]'));
      const toggle = buttons.find((b) => {
        const label = b.getAttribute('aria-label') || '';
        return label === ${JSON.stringify(SELECTOR_TREE_TOGGLE_SHOW)} || label === ${JSON.stringify(SELECTOR_TREE_TOGGLE_HIDE)};
      });
      if (toggle === undefined) return false;
      toggle.focus();
      return document.activeElement === toggle;
    })()`
  );
  if (started !== true) {
    throw new ProbeError(
      'could not place focus on the drawer header tree toggle to start the Tab walk'
    );
  }

  let everInRow = false;
  let last = 'nothing';
  let atRow = null;
  const trace = [];
  for (let press = 1; press <= maxPresses; press += 1) {
    await pressKey(cdp, 'Tab', 9);
    const state = await callInPage(cdp, describeFocus);
    last = `<${state.tag}> ${state.label ?? ''}`.trim();
    trace.push(`${state.insideRow ? '[row] ' : ''}${last}`.slice(0, 48));
    if (state.insideRow && atRow === null) {
      // Snapshot the column at the moment focus is INSIDE the three-region row,
      // one stop before the column would be reached. A snapshot taken after the
      // walk is worthless: by then focus has wrapped back into the form and any
      // anchored control it lands on repopulates the rows.
      atRow = await callInPage(cdp, describeColumnState);
    }
    if (state.insideRow) everInRow = true;
    if (state.insideColumn) return { reachedColumn: true, presses: press, last, everInRow, trace, atRow };
  }
  return { reachedColumn: false, presses: maxPresses, last, everInRow, trace, atRow };
}

/* ========================================================================== */
/* Entry point                                                                 */
/* ========================================================================== */

function report(checks) {
  const lines = [];
  for (const check of checks) {
    lines.push(`${check.passed ? 'PASS' : 'FAIL'}  ${check.id}  ${check.title}`);
    for (const note of check.notes) lines.push(`        · ${note}`);
    for (const failure of check.failures) lines.push(`      ✗ ${failure}`);
  }
  return lines.join('\n');
}

async function runChecks(cdp, baseUrl) {
  const checks = [];

  await prepareApp(cdp, baseUrl, { heightPx: 480, treeVisible: true });

  // V11 (SC-017) needs only a selected file with line numbers — not the Addresses
  // tall fixture. Run it before focusTallFixture so a post-SF-19 row-count floor
  // miss cannot hide a glyph-over-gutter regression.
  try {
    await checkOpaqueJoin(cdp, checks);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!checks.some((check) => check.id === 'V11')) {
      const aborted = new Check('V11', 'aborted before it could run');
      aborted.fail(`the check could not run: ${message}`);
      checks.push(aborted);
    }
  }

  try {
    await focusTallFixture(cdp);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`tall fixture precondition failed (continuing remaining checks):\n  ${message}`);
  }

  // Each stage is isolated. An abort inside one — a precondition that could not
  // be established, say — becomes a FAILED check for every id that stage owns,
  // and the remaining stages still run. One broken configuration hiding the
  // other five would turn the failure list into a single line, when the whole
  // value of a run is that the list IS the worklist.
  const stages = [
    { ids: ['V0', 'V1', 'V2', 'INV-15'], run: () => checkGeometry(cdp, checks) },
    { ids: ['V3'], run: () => checkThreshold(cdp, checks) },
    { ids: ['V4'], run: () => checkScrollOwnership(cdp, checks) },
    { ids: ['V5', 'V7'], run: () => checkHeadings(cdp, checks) },
    { ids: ['V9'], run: () => checkTabOrder(cdp, checks) },
    { ids: ['V10'], run: () => checkFocusReachability(cdp, checks) },
    { ids: ['V6'], run: () => checkHeightFloor(cdp, baseUrl, checks) },
    { ids: ['V8'], run: () => checkRevealAtNarrowPane(cdp, baseUrl, checks) },
    {
      ids: ['SF23-DOCK', 'SF23-DOCK-GEO'],
      run: () => checkDockCycle(cdp, checks),
    },
    { ids: ['SF23-DOCK-NARROW'], run: () => checkDockNarrow(cdp, checks) },
  ];

  for (const stage of stages) {
    try {
      await stage.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const id of stage.ids) {
        if (checks.some((check) => check.id === id)) continue;
        const aborted = new Check(id, 'aborted before it could run');
        aborted.fail(`the check could not run: ${message}`);
        checks.push(aborted);
      }
    }
  }

  return checks;
}

/**
 * The negative run: point the probe at a page that never rendered the drawer
 * and require it to fail closed, naming the precondition. This is the only
 * thing that proves the fail-closed path is exercised rather than merely
 * written — and the reason it asserts the message rather than the exit code is
 * that a crash also exits non-zero.
 */
async function runNegative(cdp) {
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await waitFor(cdp, 'document.readyState === "complete"', 'the empty page to load', 10_000);

  try {
    await callInPage(cdp, measureGeometry);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('.rwa-code-preview')) {
      console.log(`PASS  NEGATIVE  the probe failed closed, naming the missing precondition:\n      ${message}`);
      return true;
    }
    console.error(
      `FAIL  NEGATIVE  the probe failed, but not on the missing three-region row:\n      ${message}`
    );
    return false;
  }

  console.error(
    'FAIL  NEGATIVE  the probe measured an empty page WITHOUT failing. Every check that compares ' +
      'two measurements is now free to pass at 0 === 0, which is a guard that is loaded, running ' +
      'and structurally blind.'
  );
  return false;
}

async function main() {
  const chromePath = resolveChrome();
  const server = NEGATIVE ? { baseUrl: 'about:blank', stop: async () => {} } : await startPreviewServer();
  const browser = await launchChrome(chromePath);

  try {
    if (NEGATIVE) {
      return (await runNegative(browser.cdp)) ? 0 : 1;
    }

    const checks = await runChecks(browser.cdp, server.baseUrl);
    console.log(report(checks));

    // Every expected check must have RUN. A run that aborted early, or one whose
    // checks were quietly skipped, would otherwise report "all checks passed"
    // over an empty list — the same vacuity INV-32 forbids inside the page,
    // arriving in the driver instead.
    const ran = new Set(checks.map((check) => check.id));
    const missing = EXPECTED_CHECK_IDS.filter((id) => !ran.has(id));

    if (!SELF_CHECK) {
      const failed = checks.filter((check) => !check.passed);
      if (missing.length > 0) {
        console.error(
          `\n${missing.length} check(s) never ran: ${missing.join(', ')}. ` +
            'A probe that reports on the checks it managed to reach is not a guard.'
        );
        return 1;
      }
      if (failed.length === 0) {
        console.log(`\nAll ${checks.length} layout checks passed.`);
        return 0;
      }
      console.error(`\n${failed.length} of ${checks.length} layout checks failed.`);
      return 1;
    }

    // Self-check by removal: the column is forced visible at every width, so V1
    // and V3 must fail — V1 because the code pane drops below its floor, V3
    // because the visibility predicate is now constant. Both are asserted
    // SPECIFICALLY: "the run exited non-zero" would be satisfied by a crash.
    const v1 = checks.find((check) => check.id === 'V1');
    const v3 = checks.find((check) => check.id === 'V3');
    const problems = [];

    if (v1 === undefined) problems.push('V1 did not run at all under the self-check');
    else if (v1.passed) {
      problems.push(
        'V1 PASSED under a stylesheet that forces the column visible at every width. At 900x700 ' +
          'with the tree shown the code pane must be about 328px, far below the ' +
          `${CODE_PANE_FLOOR_PX}px floor. V1 is not measuring what it claims to measure.`
      );
    } else {
      console.log(`\nV1 failed as required:\n      ${v1.failures[0]}`);
    }

    if (v3 === undefined) problems.push('V3 did not run at all under the self-check');
    else if (v3.passed) {
      problems.push('V3 PASSED under the forced-visible stylesheet; there is no switch point to find.');
    } else if (!v3.failures.some((failure) => failure.includes('CONSTANT'))) {
      problems.push(
        'V3 failed under the self-check, but NOT by detecting a constant predicate — it failed ' +
          `with: ${v3.failures[0]}\n      A search over a constant predicate converges on its own ` +
          'bound and reports it; a V3 that fails by arithmetic accident is a self-check certifying itself.'
      );
    } else {
      console.log(`\nV3 failed as required, naming the constancy:\n      ${v3.failures[0]}`);
    }

    if (problems.length === 0) {
      console.log('\nSelf-check passed: V1 and V3 both failed, each for its own reason.');
      return 0;
    }
    console.error(`\nSELF-CHECK FAILED:\n  - ${problems.join('\n  - ')}`);
    return 1;
  } finally {
    await browser.stop();
    await server.stop();
  }
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(`\nPROBE ABORTED: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack && process.env.PROBE_DEBUG === '1') {
      console.error(error.stack);
    }
    process.exit(1);
  });
