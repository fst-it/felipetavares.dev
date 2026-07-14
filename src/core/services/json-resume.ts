/**
 * JSON Resume (jsonresume.org schema) builder (V3b addendum commit 2). Pure mapping from the
 * same redacted content-repository entities every HTML page reads — roles, dossier, site
 * singletons — into the standard schema, so any JSON-Resume-aware tool can parse this site's CV
 * without a custom scraper. No new facts, no un-redacted data: this reads the identical roles/
 * dossier data the /experience and /experience/dossier pages render.
 */
import type { Role } from '../entities/role';
import type { Dossier, SiteSocialLink } from '../ports/content-repository';

export interface JsonResumeBasics {
  name: string;
  label: string;
  email: string;
  url: string;
  summary: string;
  profiles: { network: string; username: string; url: string }[];
}

export interface JsonResumeWork {
  name: string;
  position: string;
  location: string;
  startDate: string;
  endDate?: string;
  summary: string;
  highlights: string[];
}

export interface JsonResumeEducation {
  institution: string;
  studyType: string;
}

export interface JsonResumeSkill {
  name: string;
  level: string;
  keywords: string[];
}

export interface JsonResumeLanguage {
  language: string;
  fluency: string;
}

export interface JsonResume {
  $schema: string;
  basics: JsonResumeBasics;
  work: JsonResumeWork[];
  education: JsonResumeEducation[];
  skills: JsonResumeSkill[];
  languages: JsonResumeLanguage[];
  certificates: { name: string }[];
}

/** Coerces this site's YYYY-MM role date strings into JSON Resume's expected YYYY-MM-DD form. */
function toIsoDate(value: string): string {
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
}

function networkFromIcon(icon: string): string {
  if (icon === 'linkedin') return 'LinkedIn';
  if (icon === 'github') return 'GitHub';
  return icon;
}

export function buildJsonResume(params: {
  name: string;
  contactEmail: string;
  siteUrl: string;
  summary: string;
  roles: Role[]; // reverse-chronological (current role first)
  dossier: Dossier;
  socialLinks: SiteSocialLink[];
}): JsonResume {
  const { name, contactEmail, siteUrl, summary, roles, dossier, socialLinks } = params;

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/master/schema.json',
    basics: {
      name,
      label: 'Sr. Principal Architect Leader — Enterprise Architecture, AI & Data Strategy',
      email: contactEmail,
      url: siteUrl,
      summary,
      // `SiteSocialLink.label` is a platform display name ("LinkedIn", "GitHub"), not a handle —
      // there's no separate username field in the site's social-link data, so `username` here is
      // just the same display name JSON Resume expects when no handle is tracked separately.
      profiles: socialLinks.map((link) => ({
        network: networkFromIcon(link.icon),
        username: link.label,
        url: link.url,
      })),
    },
    work: roles.map((role) => ({
      name: role.org,
      position: role.title,
      location: role.additionalLocation ? `${role.location} / ${role.additionalLocation}` : role.location,
      startDate: toIsoDate(role.start),
      endDate: role.end ? toIsoDate(role.end) : undefined,
      summary: role.arc,
      highlights: role.impact.map((item) => `${item.metric}: ${item.narrative}`),
    })),
    education: dossier.education.map((e) => ({ institution: e.school, studyType: e.degree })),
    skills: dossier.competencyMatrix.map((row) => ({
      name: row.domain,
      level: `${row.depth}/5`,
      keywords: [row.evidence],
    })),
    languages: dossier.languages.map((lang) => ({ language: lang.name, fluency: lang.level })),
    certificates: dossier.certifications.map((cert) => ({ name: cert })),
  };
}
