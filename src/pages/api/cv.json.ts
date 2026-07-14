import type { APIRoute } from 'astro';
import { contentRepository, siteConfig } from '../../config/site';
import { buildJsonResume } from '../../core/services/json-resume';

export const prerender = true;

/**
 * /api/cv.json (V3b addendum commit 2) — JSON Resume standard (jsonresume.org schema), built from
 * roles + dossier + site singletons. Prerendered static JSON at build time (no server/Worker cost
 * at request time, unlike /api/contact and /api/chat), redacted data only — same
 * ContentRepository every HTML page reads.
 */
export const GET: APIRoute = async () => {
  const [positioning, roles, dossier, socialLinks] = await Promise.all([
    contentRepository.getPositioning(),
    contentRepository.getRoles(),
    contentRepository.getDossier(),
    contentRepository.getSocialLinks(),
  ]);

  const resume = buildJsonResume({
    name: siteConfig.name,
    contactEmail: siteConfig.contactEmail,
    siteUrl: siteConfig.url,
    summary: positioning.statement,
    roles,
    dossier,
    socialLinks,
  });

  return new Response(JSON.stringify(resume, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
