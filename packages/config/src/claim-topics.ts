import type { ClaimTopic } from './types';

/**
 * Whether `topic` is part of the configuration to be deployed.
 *
 * The single definition of `ClaimTopic.selected`'s meaning. The field has three
 * distinguishable input states — absent, `true`, `false` — and the first two are
 * equivalent for every reader, so the predicate is `!== false`. Spellings that
 * happen to agree on today's data are still wrong: `=== true` and `!!selected`
 * both read every pre-existing draft (which carries no `selected` on any topic)
 * as unselected, which silently empties the chain projection of a config that
 * still validates.
 *
 * Lives here, beside the type that declares the field, because the wizard and
 * the CLI need the field's MEANING and must not import a generator package to
 * read their own schema. The projection built on top of it — which array
 * positions survive into a chain artefact — is generator behaviour and lives in
 * `@openzeppelin/codegen-rwa-common`.
 *
 * Reads `selected` by property access only. An `ownKeys` trap — an object
 * spread, `Object.keys`, `JSON.stringify` — would record the topic's bare
 * element path terminally under a recording reader, which no pruning removes;
 * `'selected' in topic` and `Object.hasOwn(topic, 'selected')` are safe.
 */
export function isClaimTopicSelected(topic: ClaimTopic): boolean {
  return topic.selected !== false;
}
