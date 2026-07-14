import type { LlmProvider, LlmCompleteOptions } from '../../core/ports/llm-provider';
import type { ChatMessage } from '../../core/entities/chat-message';

/**
 * Dev fallback LlmProvider (spec section 4/8) — used whenever no LLM binding/key is configured,
 * i.e. always in local dev until Felipe activates Cloudflare/Anthropic at deployment. Instead of
 * calling any model, it assembles a canned but genuinely grounded answer directly from the
 * retrieved context block already present in the message array (see chat-service.buildChatPrompt),
 * so the full retrieval -> prompt -> stream -> sources UX is testable end-to-end with zero keys.
 */
export class EchoDevProvider implements LlmProvider {
  readonly name = 'echo-dev';

  async *complete(messages: ChatMessage[], _opts?: LlmCompleteOptions): AsyncIterable<string> {
    const contextMessage = messages.find(
      (m) => m.role === 'system' && m.content.startsWith('<context>')
    );
    const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    const excerpts = extractExcerpts(contextMessage?.content ?? '');

    const response =
      excerpts.length > 0
        ? buildGroundedAnswer(question, excerpts)
        : "I don't have enough on the site to answer that confidently — you can reach Felipe directly on LinkedIn.";

    // Stream word-by-word to exercise the same SSE chunking path a real provider would use.
    const words = response.split(' ');
    for (const word of words) {
      yield word + ' ';
    }
  }
}

interface Excerpt {
  title: string;
  url: string;
  snippet: string;
}

function extractExcerpts(contextBlock: string): Excerpt[] {
  const entries = contextBlock.split(/\n\n(?=\[\d+\] Source:)/);
  const excerpts: Excerpt[] = [];

  for (const entry of entries) {
    const match = entry.match(/Source: (.+?) \((.+?)\)\n([\s\S]*)/);
    if (!match) continue;
    const [, title, url, body] = match;
    const snippet = body.trim().split(/\s+/).slice(0, 40).join(' ');
    if (snippet) excerpts.push({ title, url, snippet });
  }

  return excerpts;
}

function buildGroundedAnswer(question: string, excerpts: Excerpt[]): string {
  const top = excerpts.slice(0, 3);
  const lines = [
    `Based on felipetavares.dev's content, here's what's relevant to "${question.trim()}":`,
    '',
    ...top.map((e) => `- ${e.snippet}${e.snippet.endsWith('.') ? '' : '…'} (${e.title})`),
  ];
  return lines.join('\n');
}
