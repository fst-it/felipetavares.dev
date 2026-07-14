import type { APIRoute } from 'astro';
import { contentRepository, siteConfig } from '../config/site';

export const prerender = true;

/**
 * llms.txt (spec section 10) — emerging convention pointing AI crawlers/agents at the key,
 * markdown-summarizable pages of the site. Plain text, markdown-link format, regenerated at
 * build time so new articles/projects show up automatically.
 */
export const GET: APIRoute = async () => {
  const [projects, articles] = await Promise.all([
    contentRepository.getProjects(),
    contentRepository.getArticles(),
  ]);

  const lines: string[] = [
    `# ${siteConfig.name}`,
    '',
    `> ${siteConfig.defaultDescription}`,
    '',
    '## Key pages',
    '',
    `- [Home](${siteConfig.url}/)`,
    `- [Journey — career story](${siteConfig.url}/experience)`,
    `- [Executive Dossier](${siteConfig.url}/experience/dossier)`,
    `- [Projects](${siteConfig.url}/projects)`,
    `- [Writing](${siteConfig.url}/writing)`,
    `- [Reading — book and article reviews](${siteConfig.url}/reading)`,
    `- [Speaking & Media](${siteConfig.url}/speaking)`,
    `- [Contact](${siteConfig.url}/contact)`,
    `- [Engineering — how this site is built](${siteConfig.url}/engineering)`,
    `- [Accessibility](${siteConfig.url}/accessibility)`,
    `- [Privacy](${siteConfig.url}/privacy)`,
    '',
    '## Projects',
    '',
    ...projects.map((p) => `- [${p.title}](${siteConfig.url}/projects/${p.slug}) — ${p.tagline}`),
    '',
    '## Writing',
    '',
    ...articles.map((a) => `- [${a.title}](${siteConfig.url}/writing/${a.slug}) — ${a.description}`),
    '',
    // Markdown twins (V3b addendum commit 2) — clean, front-matter-free markdown siblings of the
    // HTML pages above, for agents/crawlers that prefer plain text over HTML parsing.
    '## Markdown twins',
    '',
    `- [Home](${siteConfig.url}/home.md)`,
    `- [Journey](${siteConfig.url}/experience/index.md)`,
    `- [Executive Dossier](${siteConfig.url}/experience/dossier.md)`,
    `- [Reading](${siteConfig.url}/reading/index.md)`,
    `- [Speaking & Media](${siteConfig.url}/speaking/index.md)`,
    `- [Contact](${siteConfig.url}/contact/index.md)`,
    `- [Engineering](${siteConfig.url}/engineering.md)`,
    ...projects.map((p) => `- [${p.title}](${siteConfig.url}/projects/${p.slug}.md)`),
    ...articles.map((a) => `- [${a.title}](${siteConfig.url}/writing/${a.slug}.md)`),
    '',
    '## Machine-readable',
    '',
    `- [Full site content, concatenated](${siteConfig.url}/llms-full.txt)`,
    `- [Machine-readable CV (JSON Resume)](${siteConfig.url}/api/cv.json)`,
    '',
    // MCP server (packages/mcp) — typed tools over the same content, for agents that support MCP
    // rather than URL fetching. Local stdio path documented here; the remote endpoint below
    // activates once Cloudflare is connected (see docs/mcp.md).
    '## MCP server',
    '',
    '- Local (stdio): `npx felipetavares-mcp` — no credentials required',
    `- Remote (once deployed): https://mcp.felipetavares.dev/mcp`,
    '- Docs: https://github.com/fst-it/fst_website/blob/main/docs/mcp.md',
    '- Tools: get_cv, get_profile, search_content, get_page, list_projects, list_articles, ask_felipe, leave_message',
    '',
    // PT-BR routes archived for v1 launch (ledger row 65 — _pt directory, re-enable when
    // _pt is restored to pages/pt and the language toggle is re-added to the header).
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
