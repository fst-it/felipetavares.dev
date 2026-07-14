import { describe, it, expect } from 'vitest';
import {
  generateSubstackHtml,
  generateLinkedInPost,
  generateRedditPost,
  generateXThread,
  type PublishKitInput,
} from '../publish-kit';

const baseInput: PublishKitInput = {
  title: 'Why I Built This Site the Way I Did',
  description: 'An architecture story about Astro islands, hexagonal ports, and a $0 stack.',
  slug: 'why-i-built-this-site-the-way-i-did',
  pubDate: new Date('2026-07-05'),
  tags: ['Architecture', 'Astro', 'AI & Agentic Engineering'],
  canonicalUrl: 'https://felipetavares.dev/writing/why-i-built-this-site-the-way-i-did',
  contentHtml: '<p>Most personal sites start with a template.</p><img src="/images/diagram.png" />',
  plainText:
    'Most personal sites start with a template and end with a Wordpress plugin problem. I wanted the opposite. This is the story of the decisions behind the site.',
};

describe('generateSubstackHtml', () => {
  it('includes a canonical-URL note at the top', () => {
    const html = generateSubstackHtml(baseInput, 'https://felipetavares.dev');
    expect(html).toContain('Originally published at');
    expect(html).toContain(baseInput.canonicalUrl);
  });

  it('absolutizes root-relative image URLs', () => {
    const html = generateSubstackHtml(baseInput, 'https://felipetavares.dev');
    expect(html).toContain('src="https://felipetavares.dev/images/diagram.png"');
    expect(html).not.toContain('src="/images/diagram.png"');
  });
});

describe('generateLinkedInPost', () => {
  it('stays within the 1300 character limit', () => {
    const post = generateLinkedInPost(baseInput);
    expect(post.length).toBeLessThanOrEqual(1300);
  });

  it('leads with a hook and includes the canonical link and hashtags', () => {
    const post = generateLinkedInPost(baseInput);
    expect(post.startsWith('Most personal sites start with a template')).toBe(true);
    expect(post).toContain(baseInput.canonicalUrl);
    expect(post).toMatch(/#\w+/);
  });

  it('truncates an overlong description while staying under the limit', () => {
    const longInput: PublishKitInput = {
      ...baseInput,
      description: 'A'.repeat(2000),
    };
    const post = generateLinkedInPost(longInput);
    expect(post.length).toBeLessThanOrEqual(1300);
    expect(post).toContain(longInput.canonicalUrl);
  });
});

describe('generateRedditPost', () => {
  it('uses neutral framing and suggests subreddits without editorializing', () => {
    const post = generateRedditPost(baseInput);
    expect(post).toContain(baseInput.canonicalUrl);
    expect(post).toMatch(/r\/softwarearchitecture|r\/programming/);
    expect(post).toContain('neutral');
  });
});

describe('generateXThread', () => {
  it('splits into numbered tweets, each within 280 characters', () => {
    const thread = generateXThread(baseInput);
    const tweets = thread.split('\n\n---\n\n');
    expect(tweets.length).toBeGreaterThan(0);
    for (const tweet of tweets) {
      // Strip the "n/total\n" numbering prefix before measuring the tweet body itself.
      const body = tweet.replace(/^\d+\/\d+\n/, '');
      expect(body.length).toBeLessThanOrEqual(280);
    }
  });

  it('first tweet contains the canonical link', () => {
    const thread = generateXThread(baseInput);
    const firstTweet = thread.split('\n\n---\n\n')[0];
    expect(firstTweet).toContain(baseInput.canonicalUrl);
  });
});
