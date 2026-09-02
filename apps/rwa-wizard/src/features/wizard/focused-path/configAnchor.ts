import { tokenPaths } from '../config-path';

/**
 * The anchor dialect: what a wizard control edits, named in terms that do not
 * move when the draft does.
 *
 * An anchor is deliberately **not** a `ConfigPath`. A path carries array
 * indices and the selected ownership variant, and both are draft state; writing
 * draft state into markup is the failure this unit exists to prevent, so the
 * types are arranged to make it impossible. `anchorToConfigPath` is the only
 * function that can produce a `ConfigPath`, and it takes the draft.
 */

/** The five constant token-scope locations, keyed by their `tokenPaths` member. */
export type TokenAnchorField = keyof typeof tokenPaths;

/**
 * Decoded anchor. One variant per shape of thing a wizard control can edit.
 * Every variant carries only draft-**independent** identity: an id, a role
 * name, a numeric topic id, an issuer address. No index, no ownership variant.
 * INV-4.
 */
export type ConfigAnchor =
  | { readonly kind: 'token'; readonly field: TokenAnchorField }
  | { readonly kind: 'admin'; readonly controlId: string }
  | { readonly kind: 'identityControl'; readonly controlId: string }
  | { readonly kind: 'ownershipType' }
  | { readonly kind: 'ownershipAddress' }
  | { readonly kind: 'role'; readonly roleName: string }
  | { readonly kind: 'module'; readonly moduleId: string }
  | { readonly kind: 'moduleConfig'; readonly moduleId: string; readonly fieldKey: string }
  | { readonly kind: 'claimTopic'; readonly topicId: number }
  | { readonly kind: 'claimTopicDraft' }
  | { readonly kind: 'issuer'; readonly address: string }
  | { readonly kind: 'issuerTopics'; readonly address: string }
  | { readonly kind: 'issuerDraft' };

/**
 * Encoded form. A template-literal union, so a hand-written string in JSX is a
 * type error and every anchor in the markup came from a builder below. INV-9.
 */
export type ConfigAnchorKey =
  | `token|${TokenAnchorField}`
  | `admin|${string}`
  | `identityControl|${string}`
  | 'ownershipType'
  | 'ownershipAddress'
  | `role|${string}`
  | `module|${string}`
  | `moduleConfig|${string}|${string}`
  | `claimTopic|${number}`
  | 'claimTopicDraft'
  | `issuer|${string}`
  | `issuerTopics|${string}`
  | 'issuerDraft';

/** Attribute name. The single place this string literal lives. */
export const CONFIG_ANCHOR_ATTR = 'data-config-anchor' as const;

/**
 * Field-root attribute the kit's `AddressListField` renders from its `id`. It
 * carries the same identifier the entry control carries, so the two channels
 * agree by construction rather than by coincidence. INV-20.
 */
export const FIELD_ID_ATTR = 'data-field-id' as const;

/**
 * Argument separator. `|` and not `:` or `.`: role names contain spaces and
 * colons are plausible in future ids, and `.` is the *path* dialect's separator
 * — reusing it would invite exactly the confusion this module avoids. That `|`
 * appears in no module id, field key, role name or address is pinned by a test
 * over every registered target's real catalog (INV-11), not assumed.
 */
const SEP = '|';

// Builders. Anchors are never written as template literals at call sites, for
// the reason SF-6 gave for paths: the separator then lives in one file, and a
// test over the real catalogs can prove no argument contains it.

export const tokenAnchor = (field: TokenAnchorField): ConfigAnchorKey => `token|${field}`;

export const adminAnchor = (controlId: string): ConfigAnchorKey => `admin|${controlId}`;

export const identityControlAnchor = (controlId: string): ConfigAnchorKey =>
  `identityControl|${controlId}`;

export const OWNERSHIP_TYPE_ANCHOR = 'ownershipType' satisfies ConfigAnchorKey;

export const OWNERSHIP_ADDRESS_ANCHOR = 'ownershipAddress' satisfies ConfigAnchorKey;

export const roleAnchor = (roleName: string): ConfigAnchorKey => `role|${roleName}`;

export const moduleAnchor = (moduleId: string): ConfigAnchorKey => `module|${moduleId}`;

export const moduleConfigAnchor = (moduleId: string, fieldKey: string): ConfigAnchorKey =>
  `moduleConfig|${moduleId}|${fieldKey}`;

/** `topicId` is a `ClaimTopic['id']`, which is an integer; a non-integer encodes
 *  to a key `parseConfigAnchor` rejects, which is the safe direction. */
export const claimTopicAnchor = (topicId: number): ConfigAnchorKey => `claimTopic|${topicId}`;

export const CLAIM_TOPIC_DRAFT_ANCHOR = 'claimTopicDraft' satisfies ConfigAnchorKey;

export const issuerAnchor = (address: string): ConfigAnchorKey => `issuer|${address}`;

export const issuerTopicsAnchor = (address: string): ConfigAnchorKey => `issuerTopics|${address}`;

export const ISSUER_DRAFT_ANCHOR = 'issuerDraft' satisfies ConfigAnchorKey;

/** `0`, `-3`, `12` — but not `01`, `+1`, `1.5`, `1e3` or the empty string. */
const INTEGER = /^-?(?:0|[1-9][0-9]*)$/;

function isTokenAnchorField(value: string): value is TokenAnchorField {
  return Object.prototype.hasOwnProperty.call(tokenPaths, value);
}

/** Exactly one argument, non-empty. `null` for any other shape. */
function arg1(segments: readonly string[]): string | null {
  if (segments.length !== 2) return null;
  const [, only] = segments;
  return only !== undefined && only.length > 0 ? only : null;
}

/** Exactly two arguments, neither empty. Tuple-typed so the cases below need no
 *  index access and stay correct under `noUncheckedIndexedAccess`. */
function arg2(segments: readonly string[]): readonly [string, string] | null {
  if (segments.length !== 3) return null;
  const [, first, second] = segments;
  if (first === undefined || first.length === 0) return null;
  if (second === undefined || second.length === 0) return null;
  return [first, second];
}

/**
 * Decode an attribute value.
 *
 * **Never throws and never partially succeeds.** The input is an untrusted DOM
 * string, and a malformed one must read exactly like an absent one — the walk
 * in `resolveFocusedConfigPath` continues outward on `null`, so a corrupted
 * attribute degrades to the enclosing cluster's answer rather than to a
 * confidently wrong one. Unknown kind, wrong argument count, empty argument and
 * a non-integer topic id all yield `null`. INV-10.
 *
 * Deliberately **not** the invertible parser pair SF-6 needed: SF-6 round-trips
 * because codegen hands it paths it did not build, whereas here the wizard is
 * the only producer, so totality is the property and invertibility is not.
 */
export function parseConfigAnchor(value: string): ConfigAnchor | null {
  const segments = value.split(SEP);
  const kind = segments[0];

  switch (kind) {
    case 'token': {
      const field = arg1(segments);
      return field !== null && isTokenAnchorField(field) ? { kind: 'token', field } : null;
    }
    case 'admin': {
      const controlId = arg1(segments);
      return controlId === null ? null : { kind: 'admin', controlId };
    }
    case 'identityControl': {
      const controlId = arg1(segments);
      return controlId === null ? null : { kind: 'identityControl', controlId };
    }
    case 'ownershipType':
      return segments.length === 1 ? { kind: 'ownershipType' } : null;
    case 'ownershipAddress':
      return segments.length === 1 ? { kind: 'ownershipAddress' } : null;
    case 'role': {
      const roleName = arg1(segments);
      return roleName === null ? null : { kind: 'role', roleName };
    }
    case 'module': {
      const moduleId = arg1(segments);
      return moduleId === null ? null : { kind: 'module', moduleId };
    }
    case 'moduleConfig': {
      const parsed = arg2(segments);
      return parsed === null
        ? null
        : { kind: 'moduleConfig', moduleId: parsed[0], fieldKey: parsed[1] };
    }
    case 'claimTopic': {
      const raw = arg1(segments);
      return raw !== null && INTEGER.test(raw)
        ? { kind: 'claimTopic', topicId: Number(raw) }
        : null;
    }
    case 'claimTopicDraft':
      return segments.length === 1 ? { kind: 'claimTopicDraft' } : null;
    case 'issuer': {
      const address = arg1(segments);
      return address === null ? null : { kind: 'issuer', address };
    }
    case 'issuerTopics': {
      const address = arg1(segments);
      return address === null ? null : { kind: 'issuerTopics', address };
    }
    case 'issuerDraft':
      return segments.length === 1 ? { kind: 'issuerDraft' } : null;
    default:
      return null;
  }
}

/**
 * Whether a raw attribute value is a well-formed anchor key.
 *
 * A narrowing predicate over `parseConfigAnchor`, which already accepts exactly
 * the well-formed keys and rejects every other shape — unknown kind, wrong
 * argument count, empty argument, non-integer topic id (INV-10). It exists so
 * the key walk can return a *typed* key without an `as` cast: the DOM hands us
 * a `string`, and this is the one place that becomes a `ConfigAnchorKey`.
 * INV-11.
 *
 * A cast instead of a predicate would type-check and be invisible in review,
 * and a corrupted attribute would then be stored as the inspected subject and
 * decode to `null` at read time — the column silently describing nothing while
 * an element that does resolve sits focused.
 *
 * Deliberately **not** the invertible parser pair SF-6 needed. Invertibility is
 * still not a property of this dialect; what the subject needs is that the key
 * the walk returns resolves to the same path the element resolves to, and that
 * holds by construction because the path is computed *from* that key.
 */
export function isConfigAnchorKey(value: string): value is ConfigAnchorKey {
  return parseConfigAnchor(value) !== null;
}

/**
 * Whether an anchor can ever be the impact column's subject.
 *
 * False for exactly the two draft anchors, and the reason is the same one that
 * makes them useful for focus: `claimTopicDraft` and `issuerDraft` name the slot
 * the *next* item will occupy (see `anchorToConfigPath`'s `claimTopicDraft` and
 * `issuerDraft` arms), so they name no item at all. Nothing has been generated
 * for that slot, so there is nothing the column could truthfully say about it,
 * and a subject pointing there is precisely the one-slot-past wrong answer that
 * makes the add button appear to describe the item after the one just created.
 * INV-8.
 *
 * **The refusal is load-bearing, not defensive.** An add handler writes the
 * created item's anchor directly, and the same interaction's document `click`
 * listener resolves the Add button to *its* draft anchor. The direct write
 * survives because this competing write is refused — not because it happens to
 * run first. It does not always run first: `TopicToggleGroup`'s Add is a plain
 * synchronous `onClick`, while `TrustedIssuersSection`'s is
 * `onClick={handleSubmit(handleAdd)}` and react-hook-form's `handleSubmit` is
 * async, so there the handler runs a microtask *after* the listener. Reordering
 * anything to "fix" an ordering problem removes the protection silently.
 * INV-19.
 *
 * An exhaustive `switch` with a `never` tail and not a `Set` of kind strings: a
 * fourteenth anchor kind that also names a pending slot must be a compile error
 * here, not a silent `true`.
 */
export function isInspectableAnchor(anchor: ConfigAnchor): boolean {
  switch (anchor.kind) {
    case 'token':
    case 'admin':
    case 'identityControl':
    case 'ownershipType':
    case 'ownershipAddress':
    case 'role':
    case 'module':
    case 'moduleConfig':
    case 'claimTopic':
    case 'issuer':
    case 'issuerTopics':
      return true;
    case 'claimTopicDraft':
    case 'issuerDraft':
      return false;
    default: {
      const exhaustive: never = anchor;
      return exhaustive;
    }
  }
}
