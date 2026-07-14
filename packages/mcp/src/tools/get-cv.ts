/**
 * `get_cv` — deterministic tool, zero LLM. Returns Felipe's CV as a JSON Resume document
 * (jsonresume.org schema), built by the same `buildJsonResume` pure function `/api/cv.json`
 * calls — the only difference is where the input data comes from (disk read here vs
 * ContentRepository there; see ../content-loader.ts for why).
 */
import { z } from 'zod';
import { buildJsonResume } from '../../../../src/core/services/json-resume';
import { loadPositioning, loadRoles, loadDossier, loadSocialLinks } from '../content-loader';

export const getCvInputSchema = z.object({}).strict();

export const SITE_NAME = 'Felipe Tavares';
export const SITE_URL = 'https://felipetavares.dev';
export const SITE_CONTACT_EMAIL = 'contact@felipetavares.dev';

export async function getCv() {
  const [positioning, roles, dossier, socialLinks] = await Promise.all([
    loadPositioning(),
    loadRoles(),
    loadDossier(),
    loadSocialLinks(),
  ]);

  return buildJsonResume({
    name: SITE_NAME,
    contactEmail: SITE_CONTACT_EMAIL,
    siteUrl: SITE_URL,
    summary: positioning.statement,
    roles,
    dossier,
    socialLinks,
  });
}

export const getCvToolDefinition = {
  title: 'Get CV',
  description:
    "Returns Felipe Tavares' CV as a JSON Resume document (jsonresume.org schema: basics, work " +
    'history, education, skills, languages, certificates). No input required. Use this when an ' +
    "agent needs Felipe's structured career history rather than prose — e.g. to answer \"what " +
    'roles has Felipe held\" or to populate an application form. Returns the exact same data as ' +
    'https://felipetavares.dev/api/cv.json.',
  inputSchema: getCvInputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
