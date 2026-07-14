/**
 * `get_profile` — deterministic tool, zero LLM. Returns Felipe's structured positioning
 * statement, the 12 domains of expertise, and his social/contact links, built by the shared
 * `buildProfile` pure function (src/core/services/profile.ts) — the same one a future site
 * feature would call if it ever needed this exact shape.
 */
import { z } from 'zod';
import { buildProfile } from '../../../../src/core/services/profile';
import { loadPositioning, loadSkillDomains, loadSocialLinks } from '../content-loader';
import { SITE_NAME, SITE_URL } from './get-cv';

export const getProfileInputSchema = z.object({}).strict();

export async function getProfile() {
  const [positioning, skillDomains, socialLinks] = await Promise.all([
    loadPositioning(),
    loadSkillDomains(),
    loadSocialLinks(),
  ]);

  return buildProfile({
    name: SITE_NAME,
    siteUrl: SITE_URL,
    positioning,
    skillDomains,
    socialLinks,
  });
}

export const getProfileToolDefinition = {
  title: 'Get Profile',
  description:
    "Returns Felipe Tavares' positioning statement, his 12 domains of expertise (ordered by " +
    'prominence, each with a one-line blurb), and his public links (LinkedIn, GitHub, etc). No ' +
    'input required. Use this for a quick "who is Felipe and what does he do" summary — prefer ' +
    '`get_cv` when structured work history is needed instead.',
  inputSchema: getProfileInputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
