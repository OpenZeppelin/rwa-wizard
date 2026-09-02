---
'@openzeppelin/codegen-core': minor
---

Add the optional provenance capability to the generator contract:
`GenerateOptions.recordProvenance` asks, `GenerationResult.provenance` answers,
and `hasProvenance` presence-tests the result. New `provenance/` module exports
`createConfigRecorder` (a read-through recording view of the config),
`createProvenanceCollector` (per-file scopes, `observe`, `createdBy`,
`addRange`), the config-path algebra (`parseConfigPath`, `formatConfigPath`,
`matchesConfigPath`) and the result helpers (`isProvenanceEntry`,
`mergeProvenance`, `filterProvenanceByPath`).

Line-level attribution ships with it: `createLineBuilder` is the push-and-join
emission idiom whose `text()` is `elements.join(separator)` byte for byte, and
`createPatchBuilder` mirrors `replaceExact` / `insertBeforeExact` /
`insertAfterExact` one-for-one over an upstream source. Both compute the lines
each emission occupies from the text they will produce — never by searching the
output — attribute them to the config paths read since the previous emission,
and refuse to attribute dishonestly: `ProvenanceAttributionError` covers a read
before the builder existed, a second builder on one scope, and an emission after
`text()`. Recording changes no byte of any generated file.

Fully additive: `Generator` is unchanged and every existing implementer compiles
as-is.
