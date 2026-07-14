/**
 * Publish-kit generation (spec sections 9 & 14) — pure, framework-free transformations from an
 * already-published article into per-platform syndication artifacts. No I/O here; the CLI
 * wrapper (scripts/publish-kit.ts) handles reading the MDX file and writing kit files to disk.
 */

export interface PublishKitInput {
  title: string;
  description: string;
  slug: string;
  pubDate: Date;
  tags: string[];
  canonicalUrl: string;
  /** Fully rendered article HTML (as produced by Astro's MDX renderer). */
  contentHtml: string;
  /** Plain-text body (HTML stripped), used for hook extraction and thread splitting. */
  plainText: string;
}

const X_TWEET_LIMIT = 280;
const LINKEDIN_CHAR_LIMIT = 1300;

/** Absolutizes any root-relative `src`/`href` so pasted content works outside this site's origin. */
function absolutizeUrls(html: string, siteUrl: string): string {
  return html.replace(/(src|href)="\/(?!\/)/g, `$1="${siteUrl}/`);
}

/**
 * substack.html — clean, inline-styled HTML ready to paste into Substack's editor, with a
 * canonical-URL note at the top (Substack has no native canonical-URL field, so the note is the
 * SEO mitigation) and all image/link URLs made absolute.
 */
export function generateSubstackHtml(input: PublishKitInput, siteUrl: string): string {
  const body = absolutizeUrls(input.contentHtml, siteUrl);
  return [
    `<p><em>Originally published at <a href="${input.canonicalUrl}">${input.canonicalUrl}</a></em></p>`,
    '<hr />',
    body,
  ].join('\n');
}

/** Extracts a hook-worthy opening line: first non-empty sentence of the plain-text body. */
function firstSentence(plainText: string): string {
  const match = plainText.trim().match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : plainText.slice(0, 140)).trim();
}

function hashtagsFromTags(tags: string[], max: number): string[] {
  return tags
    .slice(0, max)
    .map((tag) => `#${tag.replace(/[^a-zA-Z0-9]+/g, '')}`)
    .filter((tag) => tag.length > 1);
}

/**
 * linkedin.md — hook-first post, <=1300 chars, 3-5 hashtags, linking back to the canonical URL.
 */
export function generateLinkedInPost(input: PublishKitInput): string {
  const hook = firstSentence(input.plainText);
  const hashtags = hashtagsFromTags(input.tags, 5);
  const hashtagLine = hashtags.length >= 3 ? hashtags.join(' ') : hashtags.join(' ');

  const lines = [hook, '', input.description, '', `Full article: ${input.canonicalUrl}`];
  if (hashtagLine) lines.push('', hashtagLine);

  let post = lines.join('\n').trim();
  if (post.length > LINKEDIN_CHAR_LIMIT) {
    const overflow = post.length - LINKEDIN_CHAR_LIMIT + 1;
    const trimmedDescription = input.description.slice(0, Math.max(0, input.description.length - overflow - 1));
    const rebuilt = [hook, '', `${trimmedDescription}…`, '', `Full article: ${input.canonicalUrl}`];
    if (hashtagLine) rebuilt.push('', hashtagLine);
    post = rebuilt.join('\n').trim();
  }
  return post;
}

const SUGGESTED_SUBREDDITS: Record<string, string[]> = {
  architecture: ['r/softwarearchitecture', 'r/ExperiencedDevs'],
  ai: ['r/artificial', 'r/MachineLearning'],
  default: ['r/programming', 'r/softwarearchitecture'],
};

function suggestSubreddits(tags: string[]): string[] {
  const lowerTags = tags.map((t) => t.toLowerCase());
  const matches = new Set<string>();
  for (const tag of lowerTags) {
    for (const key of Object.keys(SUGGESTED_SUBREDDITS)) {
      if (key !== 'default' && tag.includes(key)) {
        SUGGESTED_SUBREDDITS[key].forEach((s) => matches.add(s));
      }
    }
  }
  if (matches.size === 0) SUGGESTED_SUBREDDITS.default.forEach((s) => matches.add(s));
  return [...matches];
}

/**
 * reddit.md — neutral, non-promotional framing note (Reddit penalizes marketing tone hard) plus
 * a suggested-subreddits comment block. Meant to be adapted per-community before posting, not
 * pasted verbatim.
 */
export function generateRedditPost(input: PublishKitInput): string {
  const subreddits = suggestSubreddits(input.tags);
  return [
    `**Title suggestion:** ${input.title}`,
    '',
    `${input.description}`,
    '',
    `Link: ${input.canonicalUrl}`,
    '',
    '---',
    '',
    '<!-- Suggested subreddits (tailor framing per community rules before posting): -->',
    ...subreddits.map((s) => `<!-- ${s} -->`),
    '',
    '<!-- Reminder: keep the post text neutral/technical — avoid marketing language, disclose authorship if required by the subreddit rules. -->',
  ].join('\n');
}

/** Splits plain text into <=280-char chunks on sentence boundaries where possible. */
function splitIntoTweets(plainText: string, limit: number): string[] {
  const sentences = plainText
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const tweets: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      if (current) tweets.push(current);
      // A single sentence longer than the limit gets hard-wrapped.
      if (sentence.length > limit) {
        for (let i = 0; i < sentence.length; i += limit) {
          tweets.push(sentence.slice(i, i + limit));
        }
        current = '';
      } else {
        current = sentence;
      }
    }
  }
  if (current) tweets.push(current);
  return tweets;
}

/**
 * x-thread.md — numbered thread, each tweet <=280 chars (accounting for the "n/total" suffix),
 * first tweet is the hook + link, body sentences fill subsequent tweets.
 */
export function generateXThread(input: PublishKitInput): string {
  const suffixReserve = 8; // room for " (1/12)"
  const bodyLimit = X_TWEET_LIMIT - suffixReserve;

  const hookTweet = `${firstSentence(input.plainText)}\n\n${input.canonicalUrl}`;
  const bodyTweets = splitIntoTweets(input.plainText, bodyLimit);

  const allTweets = [hookTweet, ...bodyTweets];
  const total = allTweets.length;

  return allTweets.map((tweet, i) => `${i + 1}/${total}\n${tweet}`).join('\n\n---\n\n');
}

export interface PublishKit {
  substackHtml: string;
  linkedinPost: string;
  redditPost: string;
  xThread: string;
}

export function generatePublishKit(input: PublishKitInput, siteUrl: string): PublishKit {
  return {
    substackHtml: generateSubstackHtml(input, siteUrl),
    linkedinPost: generateLinkedInPost(input),
    redditPost: generateRedditPost(input),
    xThread: generateXThread(input),
  };
}
