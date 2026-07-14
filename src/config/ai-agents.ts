/**
 * Known AI-crawler / agent User-Agent substrings (V3b addendum commit 3: "edge AI-agent
 * detection"). Matched case-insensitively as a substring against the request's User-Agent header.
 * Maintained list — update as new agents publish their own UA token (OpenAI, Anthropic, Google,
 * Perplexity, Common Crawl/CCBot, Meta, ByteDance/TikTok's Bytespider all publish theirs).
 */
export const AI_AGENT_USER_AGENTS: string[] = [
  'GPTBot',
  'ClaudeBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'meta-externalagent',
  'Bytespider',
];

/** True if the given User-Agent header value matches any known AI agent/crawler. */
export function isKnownAiAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return AI_AGENT_USER_AGENTS.some((agent) => lower.includes(agent.toLowerCase()));
}

/** True if the request's Accept header prefers text/markdown over text/html. */
export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  const mdIndex = acceptHeader.indexOf('text/markdown');
  if (mdIndex === -1) return false;
  const htmlIndex = acceptHeader.indexOf('text/html');
  // Prefers markdown if it's listed and either html isn't listed at all, or markdown appears
  // earlier in the (quality-ordered) Accept header than html.
  return htmlIndex === -1 || mdIndex < htmlIndex;
}
