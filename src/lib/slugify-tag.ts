/**
 * Shared by the /writing/tags/[tag] route's getStaticPaths and page body — kept in its own
 * module because Astro isolates getStaticPaths from sibling top-level declarations in the same
 * frontmatter block during the build (it only sees its own closures/imports).
 */
export function slugifyTag(tag: string): string {
  return tag.toLowerCase().replace(/\s+/g, '-');
}
