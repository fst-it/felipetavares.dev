import type { APIRoute } from 'astro';
import { siteConfig } from '../../../config/site';
import { contactToMarkdown } from '../../../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /pt/contact (V3d refinement addendum). Same `contactToMarkdown` function the
 *  EN twin (src/pages/contact/index.md.ts) calls, parameterized with 'pt-br'. Contact email and
 *  booking URL aren't locale-specific, same as the PT HTML page's own usage. */
export const GET: APIRoute = async () => {
  return new Response(contactToMarkdown(siteConfig.contactEmail, siteConfig.bookingUrl, 'pt-br'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
