import type { APIRoute } from 'astro';
import { siteConfig } from '../../config/site';
import { contactToMarkdown } from '../../core/services/markdown-twin';

export const prerender = true;

/** Markdown twin of /contact (V3b addendum commit 2). */
export const GET: APIRoute = async () => {
  return new Response(contactToMarkdown(siteConfig.contactEmail, siteConfig.bookingUrl), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
