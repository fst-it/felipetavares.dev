# ADR 0001: Deterministic-first — the chatbot is the only LLM call

**Status:** Accepted · **Date:** 2026-07-06

## Context

An LLM call costs money, adds latency, and can fail or hallucinate. None of
that is a good trade for a feature that has a correct, checkable answer.
This site has several features that *look* like they'd benefit from a
language model — search, publish-kit copy generation, redaction scanning,
CV export, palette scoring — but every one of them has a deterministic
algorithm that produces the same output for the same input, every time,
for free.

## Decision

Every feature on this site is a deterministic function unless language
understanding is the feature itself. The chatbot (`src/core/services/
chat-service.ts` + `src/adapters/llm/*`, bound through `src/config/llm.ts`)
is the single sanctioned path that calls an LLM. Nothing else does:

- **Search** (`command-palette.ts`) scores matches with a hand-rolled
  fuzzy-ish algorithm — substring position, word-boundary bonus, length
  penalty. No embeddings, no model call.
- **Publish-kit** (`publish-kit.ts`) generates Substack/LinkedIn/Reddit/X
  copy with string templates driven by the article's own frontmatter and
  body. It reformats what's already written; it doesn't write anything new.
- **Redaction gate** (`redaction-gate.ts`) is a regex scanner against an
  explicit forbidden-pattern list. A model would be slower, non-
  reproducible, and worse at an exact-match problem.
- **CV/JSON Resume export** (`json-resume.ts`) is a pure mapping from
  existing entities to a schema. No summarization, no rewriting.
- **Palette/graph scoring** (`build-blueprint-graph.ts`) uses a seeded PRNG
  and a fixed-iteration force simulation — deterministic by construction,
  verified byte-identical across rebuilds.

The chatbot itself stays on the free tier by default (Workers AI, rate-
limited) and is provider-swappable through `config/llm.ts` — upgrading to
Claude Haiku later is a config change, not a rewrite, but it's still the
only place in the codebase where that decision needs to be made.

## Why this is enforced, not just documented

A convention that lives only in a doc gets violated the first time someone
is in a hurry. `src/core/__tests__/architecture.test.ts` scans every file
outside `chat-service.ts` / `adapters/llm/*` / `config/llm.ts` for LLM SDK
imports and known provider API hosts, and fails the build if it finds one.
Adding a model call to, say, the redaction gate is now a failing test, not
a code-review judgment call.

## Consequences

- New features start from "what's the deterministic version of this?" —
  the chatbot is the exception that proves the rule, not a precedent.
- If a genuinely language-understanding feature is proposed later (e.g.
  semantic search beyond the current lexical scorer), it either extends
  the chatbot's existing LLM path or requires a new ADR justifying a
  second sanctioned surface — it doesn't get added quietly to an
  unrelated service.
- The cost ceiling for this site stays near $0 regardless of how many
  features get added, because only one of them can ever generate a
  per-request LLM bill.
