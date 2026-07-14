export interface SkillDomain {
  name: string;
  /** Short display label for the hero constellation node (≤~16 chars). Falls back to `name`
   *  at render time if absent. Added in the short-label overlap-fix pass. */
  shortLabel?: string;
  blurb: string;
  /** Relative prominence weight; higher renders larger/first. */
  weight: number;
}
