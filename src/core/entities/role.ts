export interface RoleImpact {
  metric: string;
  narrative: string;
}

export interface TechCategory {
  label: string;
  items: string[];
}

export interface Role {
  slug: string;
  org: string;
  title: string;
  start: string;
  end?: string;
  location: string;
  /** Optional second location for roles spanning two sites (e.g. Siemens: Lisbon + Munich). */
  additionalLocation?: string;
  /** Chapter title for the Journey narrative, e.g. "Scaling platform teams". */
  arc: string;
  impact: RoleImpact[];
  /** Maps to SkillDomain names. */
  domains: string[];
  logo?: string;
  order: number;
  /** Tech-stack chips surfaced via the "Tech stack" expander (V3 addendum). Sourced only from
   *  the private source-of-truth notes; empty where the truth layer doesn't name a specific stack. */
  technologies: string[];
  /** Categorized tech display inside the "Tech stack" expander. When present, overrides the flat
   *  `technologies` list render in RoleChapter. Only used on roles with large, multi-domain stacks
   *  (e.g. Cargill EA). Other roles keep flat `technologies`. */
  techCategories?: TechCategory[];
}
