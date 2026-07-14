export type TalkType = 'talk' | 'panel' | 'paper' | 'podcast' | 'press';

export interface Talk {
  slug: string;
  title: string;
  event: string;
  date: string;
  type: TalkType;
  url?: string;
  slidesUrl?: string;
  abstract: string;
}
