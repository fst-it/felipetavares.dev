import { GitContentRepository } from '../adapters/content-git';
import type { ContentRepository } from '../core/ports/content-repository';

export const siteConfig = {
  name: 'Felipe Tavares',
  domain: 'felipetavares.dev',
  url: 'https://felipetavares.dev',
  defaultDescription:
    'Felipe Tavares — enterprise & business architecture leader. AI, data, and platform strategy for global organizations, start-ups, and scale-ups.',
  twitterHandle: '@felipetavares',
  contactEmail: 'contact@felipetavares.dev',
  // Direct 30-minute Calendly booking — owner validates bookings personally (no work calendar link).
  bookingUrl: 'https://calendly.com/felipe_tavares/30min',
  // Substack newsletter (spec section 9.4) — publication URL + embeddable iframe endpoint.
  substackUrl: 'https://fstit.substack.com',
  substackEmbedUrl: 'https://fstit.substack.com/embed',
  // Real production Turnstile sitekey — this is a PUBLIC value by design (it ships in HTML).
  // The env var PUBLIC_TURNSTILE_SITEKEY overrides it if set, but the real key is committed here
  // so any future build without that env var does NOT silently regress to the always-pass test key.
  // If you ever need the always-pass test key locally, set PUBLIC_TURNSTILE_SITEKEY=1x00000000000000000000AA.
  turnstileSitekey: import.meta.env.PUBLIC_TURNSTILE_SITEKEY || '0x4AAAAAADzdMXuLEavxtwVT',
  // Cloudflare Web Analytics beacon token (V3c commit 3) — cookieless, no default value: absent
  // until Felipe creates the analytics site in the Cloudflare dashboard and sets
  // PUBLIC_CF_ANALYTICS_TOKEN, at which point Analytics.astro starts rendering the beacon script.
  // Undefined (not a placeholder string) means "analytics off" is the actual default, unlike
  // Turnstile's test-key fallback above.
  cfAnalyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN,
};

/**
 * Single binding point for the ContentRepository port. Pages/components must
 * import `contentRepository` from here, never construct an adapter directly —
 * swapping git -> a hosted CMS later is a one-line change in this file.
 */
export const contentRepository: ContentRepository = new GitContentRepository();
