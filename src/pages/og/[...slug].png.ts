import type { APIRoute } from 'astro';
import { renderOgImage } from '../../lib/og-image';
import { contentRepository } from '../../config/site';

export const prerender = true;

interface OgPathProps {
  eyebrow: string;
  title: string;
}

/**
 * Per-page OG images (spec section 10), generated once at build time — this route only ever
 * runs during `astro build`'s prerender pass, never on a live request (guaranteed by
 * `prerender = true` plus `output: 'static'` in astro.config.mjs).
 */
export async function getStaticPaths() {
  const paths: { params: { slug: string }; props: OgPathProps }[] = [
    { params: { slug: 'home' }, props: { eyebrow: 'Felipe Tavares', title: 'Enterprise architecture and AI strategy, built to ship' } },
    { params: { slug: 'experience' }, props: { eyebrow: 'Journey', title: 'The story behind the architecture' } },
    { params: { slug: 'experience/dossier' }, props: { eyebrow: 'Executive Dossier', title: 'Felipe Tavares' } },
    { params: { slug: 'projects' }, props: { eyebrow: 'Projects', title: 'Proof, not just claims' } },
    { params: { slug: 'writing' }, props: { eyebrow: 'Writing', title: 'Architecture, AI, and leading through a global matrix' } },
    { params: { slug: 'speaking' }, props: { eyebrow: 'Speaking & Media', title: 'Talks, panels, and papers' } },
    { params: { slug: 'contact' }, props: { eyebrow: 'Contact', title: "Let's talk" } },
  ];

  const projects = await contentRepository.getProjects();
  for (const project of projects) {
    paths.push({ params: { slug: `projects/${project.slug}` }, props: { eyebrow: 'Project', title: project.title } });
  }

  const articles = await contentRepository.getArticles();
  for (const article of articles) {
    paths.push({ params: { slug: `writing/${article.slug}` }, props: { eyebrow: 'Writing', title: article.title } });
  }

  return paths;
}

export const GET: APIRoute = async ({ props }) => {
  const { eyebrow, title } = props as OgPathProps;
  const png = await renderOgImage({ eyebrow, title });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
