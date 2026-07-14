export interface Article {
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  tags: string[];
  heroImage?: string;
  draft: boolean;
  canonicalOverride?: string;
  syndication?: {
    devto?: string;
    hashnode?: string;
    substack?: string;
  };
  /** Computed at read-time from body word count. */
  readingTime?: string;
  series?: string;
  /** Rendered HTML body — only populated where a caller needs full content (e.g. RSS). */
  contentHtml?: string;
}
