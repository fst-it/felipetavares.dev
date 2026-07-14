# Reading workflow — felipetavares.dev

How reviews go from a finished book or article to a published card on `/reading`.

---

## Steps

1. **Read the work.** Felipe uses Google NotebookLM to store highlights, quotes, and research notes during and after reading. NotebookLM output is **research input only** — it does not author verdicts, ideas, or opinions. Those originate from Felipe's own bullets.

2. **Write raw bullets.** After finishing, Felipe writes a short set of bullets: verdict, one-line pull quote, 2–4 ideas worth stealing, 1–3 watch-outs, who should read it, and the relevant skill domains. These are the canonical owner judgments.

3. **Draft the MDX file.** Create a new file under `content/reading/` following this structure:

   ```mdx
   ---
   title: "Book or Article Title"
   author: "Author Name"
   sourceUrl: "https://..."
   type: book         # book | article | paper
   dateRead: 2026-07-15
   verdict: foundational   # foundational | worth-your-hours | situational | skip-unless
   verdictLine: "One sentence: the bottom-line verdict."
   ideasWorthStealing:
     - First idea — specific and concrete.
     - Second idea — equally specific.
   watchOuts:
     - One limitation or caveat the reader should know.
   whoShouldRead: "One crisp sentence on the right audience."
   domains:
     - ai-agentic-engineering   # Must match a slug from content/site/site.json skillDomains
   ---

   Optional longer essay body in MDX goes here.
   ```

4. **Check voice.** All prose passes `docs/style/voice.md` — verdictLine, ideas, and watch-outs especially. No AI-generated sentences published verbatim; own bullets only.

5. **Nothing ships without owner approval.** The MDX file is reviewed before merge. Verdicts and opinions are Felipe's; research summaries from NotebookLM stay in notes, not in the published file.

6. **Regenerate derived artifacts.** After adding a new review:

   ```bash
   pnpm build-chat-index
   pnpm --filter felipetavares-mcp build-content-snapshot
   ```

   Commit the updated `src/generated/chat-chunks.json` and `packages/mcp/src/generated/content-snapshot.json` alongside the new MDX.

7. **Run gates before pushing.**

   ```bash
   pnpm check && pnpm test && pnpm redaction-gate && pnpm build
   ```

---

## Verdict tiers

Defined in `src/core/entities/reading.ts` — the single authoritative source for slugs and labels.

| Slug | EN label | PT label |
|---|---|---|
| `foundational` | Foundational | Fundamental |
| `worth-your-hours` | Worth your hours | Vale suas horas |
| `situational` | Situational | Situacional |
| `skip-unless` | Skip unless… | Pule, a menos que… |

---

## Domain slugs

Must match `content/site/site.json skillDomains[].name` (slugified). Current list:

- `ai-agentic-engineering`
- `enterprise-business-architecture`
- `data-architecture-engineering`
- `cloud-platform-architecture`
- `integration-architecture`
- `digital-strategy-it-strategy`
- `data-management-analytics`
- `software-agentic-engineering`
- `sap-delivery-strategy-architecture`
- `portfolio-program-management`
- `product-management-agile-delivery`
- `technology-leadership-org-design`

---

## Possible follow-up

**`/reading/rss.xml`** — an RSS feed for reading reviews is a natural follow-up once reviews are being published regularly. Not built in v1 because there are zero reviews at launch; adding it later is a single-file addition that mirrors the existing `@astrojs/rss` pattern.
