/**
 * `list_projects` — deterministic tool, zero LLM. Metadata listing (slug, title, tagline, status,
 * stack, links) — no MDX body, so agents get a cheap index and follow up with `get_page` for the
 * full content of one project.
 */
import { z } from 'zod';
import { loadProjects } from '../content-loader';

export const listProjectsInputSchema = z.object({}).strict();

export interface ProjectListing {
  slug: string;
  title: string;
  tagline: string;
  status: string;
  featured: boolean;
  stack: string[];
  repoUrl?: string;
  liveUrl?: string;
}

export async function listProjects(): Promise<ProjectListing[]> {
  const projects = await loadProjects();
  return projects.map((p) => ({
    slug: p.slug,
    title: p.title,
    tagline: p.tagline,
    status: p.status,
    featured: p.featured,
    stack: p.stack,
    repoUrl: p.repoUrl,
    liveUrl: p.liveUrl,
  }));
}

export const listProjectsToolDefinition = {
  title: 'List Projects',
  description:
    "Lists every project on felipetavares.dev with its metadata (slug, title, tagline, status " +
    '("active" | "archived" | "incubating"), tech stack, repo/live links). Does not include full ' +
    'project content — pass a returned `slug` as `/projects/<slug>` to `get_page` for that. Use ' +
    'this to discover valid project slugs before calling `get_page`.',
  inputSchema: listProjectsInputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
