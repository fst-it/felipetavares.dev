export type ProjectStatus = 'active' | 'archived' | 'incubating';

export interface ProjectMetric {
  label: string;
  value: string;
}

/** One card in the Problem/Approach/Architecture/Results row (V3b addendum commit 1). */
export interface ProjectDeepDiveCard {
  summary: string;
  detail: string;
}

export interface ProjectDeepDive {
  problem: ProjectDeepDiveCard;
  approach: ProjectDeepDiveCard;
  architecture: ProjectDeepDiveCard;
  results: ProjectDeepDiveCard;
}

export interface Project {
  slug: string;
  title: string;
  tagline: string;
  /** Mission / north star — one strong line for the value-led card (H: /projects redesign). */
  northStar: string;
  /** Problem the project solves — one to two sentences, executive language. */
  problem: string;
  /** 2–3 outcome statements in plain executive language. */
  outcomes: string[];
  status: ProjectStatus;
  roleLine: string;
  stack: string[];
  repoUrl?: string;
  liveUrl?: string;
  featured: boolean;
  order: number;
  heroImage?: string;
  metrics: ProjectMetric[];
  deepDive?: ProjectDeepDive;
}
