/**
 * Markdown-twin generation (V3b addendum commit 2: "AI-ready layers"; locale param added by the
 * V3d refinement addendum). Pure, framework-free transformations from already-published,
 * already-redacted content-repository data into clean, front-matter-free markdown — the same
 * redaction rules apply because these functions read the exact same entities every HTML page
 * reads (ContentRepository), never a second copy of the data.
 *
 * No I/O here; the thin `.md.ts` Astro endpoints call these and set the response headers/content
 * type. MDX source stripping mirrors scripts/build-chat-index.ts's `stripMdxComponents` so the
 * article/project twins read as plain markdown rather than raw MDX with component tags.
 *
 * Every function below takes an optional `locale: Locale = 'en'` and reuses the exact same
 * function body for both locales — only the section-heading labels (`LABELS[locale]`) and,
 * for content methods, the `locale` forwarded into `ContentRepository` calls change. This is the
 * single generator both `src/pages/**\/*.md.ts` (EN) and `src/pages/pt/**\/*.md.ts` (PT) import,
 * per the single-definition policy (docs/architecture.md #3.1) — no parallel PT generator exists.
 */
import type { Article } from '../entities/article';
import type { Project } from '../entities/project';
import type { Role } from '../entities/role';
import type { Talk } from '../entities/talk';
import type { Reading } from '../entities/reading';
import type { Dossier, EngineeringHub, SiteCredibility, SiteHero, SitePositioning } from '../ports/content-repository';
import type { Locale } from '../../i18n';

/** Strips MDX-only component tags down to their inner markdown (mirrors build-chat-index.ts). */
export function stripMdxComponents(mdx: string): string {
  return mdx.replace(/<([A-Z]\w*)[^>]*>([\s\S]*?)<\/\1>/g, (_match, _tag, inner) => inner.trim());
}

function dateFormat(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Section-heading labels per locale (V3d refinement addendum). Deliberately not the full
 * `src/i18n` `Strings` dictionary — `core` stays decoupled from the presentation-layer string
 * catalog at runtime (only its `Locale` type is imported, matching the existing precedent in
 * `ports/content-repository.ts` and `services/contact-schema.ts`); this is just the small set of
 * markdown-twin-only heading strings, native PT-BR phrasing reviewed for this generator.
 */
const LABELS = {
  en: {
    journeyH1: 'Journey',
    dossierH1: 'Executive Dossier',
    speakingH1: 'Speaking & Media',
    contactH1: 'Contact',
    roles: 'Roles',
    present: 'Present',
    domains: 'Domains',
    techStack: 'Tech stack',
    executiveSummary: 'Executive Summary',
    competencyMatrix: 'Competency Matrix',
    experience: 'Experience',
    educationAndCertifications: 'Education & Certifications',
    languages: 'Languages',
    credibility: 'Credibility',
    domainsOfExpertise: 'Domains of expertise',
    featuredProjects: 'Featured projects',
    bookACall: 'Book a call',
    email: 'Email',
    contactIntro: 'Recruiting conversation, speaking invitation, advisory engagement, or a straightforward architecture question.',
    speakingComingSoon: 'Speaking engagements and publications coming soon.',
    link: 'Link',
    slides: 'Slides',
    atAGlance: 'At a glance',
    metrics: 'Metrics',
    stack: 'Stack',
    projects: 'Projects',
    writing: 'Writing',
    inEnglishNote: '(content below is published in English; this listing page itself is available in Portuguese at the URL above)',
    projectsEmpty: 'Projects are coming soon.',
    writingEmpty: 'The first articles are coming soon — check back shortly.',
    engineeringH1: 'Engineering',
    decisions: 'Decisions',
    whyThisStack: 'Why this stack',
    changelog: 'Changelog',
    whatItCostBought: 'What it cost/bought',
    reading: 'Reading',
    readingEmpty: 'Reviews land here as Felipe finishes them.',
    readingVerdict: 'Verdict',
    readingIdeas: 'Ideas worth stealing',
    readingWatchOuts: 'Watch-outs',
    readingWhoShouldRead: 'Who should read this',
  },
  'pt-br': {
    journeyH1: 'Trajetória',
    dossierH1: 'Dossiê Executivo',
    speakingH1: 'Palestras e Mídia',
    contactH1: 'Contato',
    roles: 'Cargos',
    present: 'Atual',
    domains: 'Domínios',
    techStack: 'Stack técnica',
    executiveSummary: 'Resumo Executivo',
    competencyMatrix: 'Matriz de Competências',
    experience: 'Experiência',
    educationAndCertifications: 'Formação e Certificações',
    languages: 'Idiomas',
    credibility: 'Credibilidade',
    domainsOfExpertise: 'Domínios de atuação',
    featuredProjects: 'Projetos em destaque',
    bookACall: 'Agendar uma conversa',
    email: 'E-mail',
    contactIntro: 'Conversa de recrutamento, convite para palestra, consultoria ou uma pergunta direta de arquitetura.',
    speakingComingSoon: 'Palestras e publicações em breve.',
    link: 'Link',
    slides: 'Slides',
    atAGlance: 'Resumo rápido',
    metrics: 'Métricas',
    stack: 'Stack',
    projects: 'Projetos',
    writing: 'Artigos',
    inEnglishNote: '(o conteúdo abaixo é publicado em inglês; esta página de listagem em si está disponível em português na URL acima)',
    projectsEmpty: 'Projetos em breve.',
    writingEmpty: 'Os primeiros artigos chegam em breve — volte para conferir.',
    engineeringH1: 'Engineering',
    decisions: 'Decisions',
    whyThisStack: 'Why this stack',
    changelog: 'Changelog',
    whatItCostBought: 'What it cost/bought',
    reading: 'Reading',
    readingEmpty: 'As resenhas chegam aqui à medida que Felipe termina as leituras.',
    readingVerdict: 'Veredicto',
    readingIdeas: 'Ideias que valem guardar',
    readingWatchOuts: 'Pontos de atenção',
    readingWhoShouldRead: 'Quem deveria ler',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function articleToMarkdown(article: Article, mdxBody: string): string {
  const lines = [
    `# ${article.title}`,
    '',
    article.description,
    '',
    `_Published ${dateFormat(article.pubDate)}${article.updatedDate ? ` · updated ${dateFormat(article.updatedDate)}` : ''} · ${article.readingTime ?? ''}_`,
    '',
    stripMdxComponents(mdxBody).trim(),
  ];
  return lines.join('\n') + '\n';
}

export function projectToMarkdown(project: Project, mdxBody: string): string {
  const lines = [`# ${project.title}`, '', project.tagline, '', `_${project.roleLine}_`, ''];

  if (project.deepDive) {
    lines.push('## At a glance', '');
    for (const [label, card] of Object.entries(project.deepDive) as [string, { summary: string; detail: string }][]) {
      lines.push(`**${label[0].toUpperCase()}${label.slice(1)}:** ${card.summary} ${card.detail}`, '');
    }
  }

  if (project.metrics.length > 0) {
    lines.push('## Metrics', '');
    for (const metric of project.metrics) lines.push(`- **${metric.label}:** ${metric.value}`);
    lines.push('');
  }

  if (project.stack.length > 0) {
    lines.push(`**Stack:** ${project.stack.join(', ')}`, '');
  }

  lines.push(stripMdxComponents(mdxBody).trim());
  return lines.join('\n') + '\n';
}

export function experienceToMarkdown(positioning: SitePositioning, roles: Role[], locale: Locale = 'en'): string {
  const t = LABELS[locale];
  const lines = [`# ${t.journeyH1}`, '', positioning.statement, '', `## ${t.roles}`, ''];

  for (const role of roles) {
    lines.push(`### ${role.title} · ${role.org}`, '', `${role.start} — ${role.end ?? t.present}, ${role.location}`, '', role.arc, '');
    for (const item of role.impact) lines.push(`- **${item.metric}:** ${item.narrative}`);
    if (role.domains.length > 0) lines.push('', `${t.domains}: ${role.domains.join(', ')}`);
    if (role.technologies.length > 0) lines.push('', `${t.techStack}: ${role.technologies.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

export function dossierToMarkdown(dossier: Dossier, roles: Role[], locale: Locale = 'en'): string {
  const t = LABELS[locale];
  const lines = [`# ${t.dossierH1}`, '', `## ${t.executiveSummary}`, '', dossier.summary, '', `## ${t.competencyMatrix}`, ''];

  for (const row of dossier.competencyMatrix) {
    lines.push(`- **${row.domain}** (depth ${row.depth}/5): ${row.evidence}`);
  }

  lines.push('', `## ${t.experience}`, '');
  for (const role of roles) {
    lines.push(`### ${role.title} · ${role.org}`, '', `${role.start} — ${role.end ?? t.present}, ${role.location}`, '');
    for (const item of role.impact) lines.push(`- **${item.metric}:** ${item.narrative}`);
    lines.push('');
  }

  lines.push(`## ${t.educationAndCertifications}`, '');
  for (const e of dossier.education) lines.push(`- ${e.degree} — ${e.school}`);
  for (const c of dossier.certifications) lines.push(`- ${c}`);

  lines.push('', `## ${t.languages}`, '');
  for (const lang of dossier.languages) lines.push(`- ${lang.name} — ${lang.level}`);

  return lines.join('\n') + '\n';
}

export function speakingToMarkdown(talks: Talk[], locale: Locale = 'en'): string {
  const t = LABELS[locale];
  const lines = [`# ${t.speakingH1}`, ''];

  if (talks.length === 0) {
    lines.push(t.speakingComingSoon);
  } else {
    for (const talk of talks) {
      lines.push(`## ${talk.title}`, '', `${talk.event}, ${talk.date} (${talk.type})`, '', talk.abstract, '');
      if (talk.url) lines.push(`${t.link}: ${talk.url}`, '');
      if (talk.slidesUrl) lines.push(`${t.slides}: ${talk.slidesUrl}`, '');
    }
  }

  return lines.join('\n') + '\n';
}

export function contactToMarkdown(contactEmail: string, bookingUrl: string, locale: Locale = 'en'): string {
  const t = LABELS[locale];
  return [`# ${t.contactH1}`, '', t.contactIntro, '', `- ${t.bookACall}: ${bookingUrl}`, `- ${t.email}: ${contactEmail}`, ''].join('\n');
}

export function homeToMarkdown(
  hero: SiteHero,
  positioning: SitePositioning,
  credibility: SiteCredibility,
  skillDomains: { name: string; blurb: string }[],
  featuredProjects: Project[],
  locale: Locale = 'en'
): string {
  const t = LABELS[locale];
  const lines = [
    `# ${hero.headline}`,
    '',
    hero.slogan,
    '',
    hero.subhead,
    '',
    positioning.statement,
    '',
    `## ${t.credibility}`,
    '',
    ...credibility.statements.map((s) => `- ${s}`),
    '',
    `## ${t.domainsOfExpertise}`,
    '',
    ...skillDomains.map((d) => `- **${d.name}:** ${d.blurb}`),
    '',
    `## ${t.featuredProjects}`,
    '',
    ...featuredProjects.map((p) => `- [${p.title}](/projects/${p.slug}) — ${p.tagline}`),
    '',
  ];
  return lines.join('\n') + '\n';
}

/**
 * Listing-twin for /projects and /writing (V3d refinement addendum) — the only two markdown twins
 * that don't have a pre-existing EN counterpart function, because neither EN listing page had a
 * twin before this change (only individual `/projects/<slug>` and `/writing/<slug>` did). Reused
 * for both locales identically; PT is the only caller today (`/pt/projects` and `/pt/writing`
 * render EN-only project/article cards with PT chrome per the V3d addendum's "stays EN-only in
 * v1" decision — this twin mirrors that same shape: PT heading, an explicit note that the linked
 * entries are English, then the EN title/tagline/description list itself).
 */
export function projectsListingToMarkdown(projects: Project[], locale: Locale = 'en'): string {
  const t = LABELS[locale];
  const lines = [`# ${t.projects}`, ''];

  if (projects.length === 0) {
    lines.push(t.projectsEmpty);
  } else {
    lines.push(t.inEnglishNote, '');
    for (const p of projects) lines.push(`- [${p.title}](/projects/${p.slug}) — ${p.tagline}`);
  }

  return lines.join('\n') + '\n';
}

export function writingListingToMarkdown(articles: Article[], locale: Locale = 'en'): string {
  const t = LABELS[locale];
  const lines = [`# ${t.writing}`, ''];

  if (articles.length === 0) {
    lines.push(t.writingEmpty);
  } else {
    lines.push(t.inEnglishNote, '');
    for (const a of articles) lines.push(`- [${a.title}](/writing/${a.slug}) — ${a.description}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Listing twin for /reading and /pt/reading — same pattern as projectsListingToMarkdown and
 * writingListingToMarkdown. With zero reviews the twin renders an empty-state line (same graceful-
 * absence contract as talks/testimonials/projects). The reading collection stays EN-only in v1
 * (review body and structured fields are not translated), so the twin's section heading is locale-
 * aware but the review entries themselves are EN.
 */
export function readingListingToMarkdown(readings: Reading[], locale: Locale = 'en'): string {
  const t = LABELS[locale];
  const lines = [`# ${t.reading}`, ''];

  if (readings.length === 0) {
    lines.push(t.readingEmpty);
  } else {
    for (const r of readings) {
      lines.push(
        `## ${r.title} — ${r.author} (${r.type}, ${dateFormat(r.dateRead)})`,
        '',
        `**${t.readingVerdict}:** [${r.verdict}] ${r.verdictLine}`,
        '',
        `**${t.readingIdeas}:**`,
        ...r.ideasWorthStealing.map((idea) => `- ${idea}`),
        '',
        `**${t.readingWatchOuts}:**`,
        ...r.watchOuts.map((w) => `- ${w}`),
        '',
        `**${t.readingWhoShouldRead}:** ${r.whoShouldRead}`,
        ''
      );
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Markdown twin for the /engineering proof-of-work hub. EN-only — same as the HTML page itself,
 * which is EN-only (no PT sibling; see the `engineering` collection comment in content.config.ts).
 * Renders decisions (with cost/bought detail), stack rationale, and changelog entries in a clean,
 * heading-structured markdown document suitable for AI agent consumption.
 */
export function engineeringHubToMarkdown(hub: EngineeringHub): string {
  const t = LABELS['en'];
  const lines = [`# ${t.engineeringH1}`, ''];

  lines.push(`## ${t.decisions}`, '');
  for (const d of hub.decisions) {
    lines.push(`### ${d.title}`, '', d.context, '', d.decision, '', `**${t.whatItCostBought}:** ${d.cost}`, '');
  }

  lines.push(`## ${t.whyThisStack}`, '');
  for (const s of hub.stack) {
    lines.push(`- **${s.name}:** ${s.reason}`);
  }
  lines.push('');

  lines.push(`## ${t.changelog}`, '');
  for (const entry of hub.changelog) {
    lines.push(`### ${entry.date} — ${entry.title}`, '', entry.detail, '');
  }

  return lines.join('\n') + '\n';
}
