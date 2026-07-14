/**
 * Profile summary builder (MCP commit 1). Pure mapping from the same redacted
 * content-repository data every HTML page reads — positioning, skill domains, social links —
 * into one structured object for agent consumers (the `get_profile` MCP tool). No new facts: this
 * is a reshaping of data that already backs the home page and /experience, not a second source.
 */
import type { SkillDomain } from '../entities/skill-domain';
import type { SitePositioning, SiteSocialLink } from '../ports/content-repository';

export interface ProfileDomain {
  name: string;
  blurb: string;
}

export interface Profile {
  name: string;
  positioning: string;
  domains: ProfileDomain[];
  links: SiteSocialLink[];
  url: string;
}

/** Builds the structured profile the `get_profile` MCP tool returns. `domains` is sorted by
 *  descending weight (most prominent first), matching the home-page ordering. */
export function buildProfile(params: {
  name: string;
  siteUrl: string;
  positioning: SitePositioning;
  skillDomains: SkillDomain[];
  socialLinks: SiteSocialLink[];
}): Profile {
  const { name, siteUrl, positioning, skillDomains, socialLinks } = params;

  return {
    name,
    positioning: positioning.statement,
    domains: [...skillDomains]
      .sort((a, b) => b.weight - a.weight)
      .map((d) => ({ name: d.name, blurb: d.blurb })),
    links: socialLinks,
    url: siteUrl,
  };
}
