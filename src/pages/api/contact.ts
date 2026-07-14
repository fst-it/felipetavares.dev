import type { APIRoute } from 'astro';
import { createContactFormSchema } from '../../core/services/contact-schema';
import { verifyTurnstileToken } from '../../core/services/turnstile';
import { siteConfig } from '../../config/site';
import { InMemoryRateLimiter } from '../../adapters/rate-limit/in-memory';
import { KvRateLimiter, type KvNamespaceLike } from '../../adapters/rate-limit/kv';
import { ConsoleEmailSender } from '../../adapters/email-console';
import { ResendEmailSender } from '../../adapters/email-resend';

export const prerender = false;

const RATE_LIMIT = { limit: 5, windowSeconds: 60 * 60 }; // 5/hr/IP — spec section 11

// Dev fallback: process-memory limiter so `pnpm dev` works without a KV binding.
// The Cloudflare-deployed Worker always has RATE_LIMIT_KV bound, so the KV adapter is used there.
const devRateLimiter = new InMemoryRateLimiter();

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400);
  }

  // `locale` is sent by ContactForm.tsx (V3d addendum) so server-side validation messages match
  // the page's language; missing/unrecognized values default to English rather than rejecting the
  // request outright.
  const requestLocale = (payload as { locale?: unknown })?.locale === 'pt-br' ? 'pt-br' : 'en';
  const parsed = createContactFormSchema(requestLocale).safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      400
    );
  }

  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
  const turnstileSecret = (env.TURNSTILE_SECRET as string | undefined) || '1x0000000000000000000000000000000AA';
  const resendApiKey = env.RESEND_API_KEY as string | undefined;
  const contactToEmail = (env.CONTACT_TO_EMAIL as string | undefined) || siteConfig.contactEmail;
  const kvBinding = env.RATE_LIMIT_KV as KvNamespaceLike | undefined;

  let ip = 'unknown';
  try {
    ip = clientAddress ?? 'unknown';
  } catch {
    // clientAddress throws outside adapters that support it (e.g. some dev contexts).
  }

  const rateLimiter = kvBinding ? new KvRateLimiter(kvBinding) : devRateLimiter;
  const rateLimitResult = await rateLimiter.check(`contact:${ip}`, RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return jsonResponse(
      { ok: false, error: 'Too many requests. Please try again in a bit.' },
      429
    );
  }

  const turnstileOk = await verifyTurnstileToken(parsed.data.turnstileToken, turnstileSecret, ip);
  if (!turnstileOk) {
    return jsonResponse({ ok: false, error: 'Verification failed. Please retry.' }, 400);
  }

  const emailSender = resendApiKey ? new ResendEmailSender(resendApiKey) : new ConsoleEmailSender();

  try {
    await emailSender.send({
      from: 'Contact form <contact@felipetavares.dev>',
      to: contactToEmail,
      subject: `[felipetavares.dev] ${parsed.data.topic} — ${parsed.data.name}`,
      body: `From: ${parsed.data.name} <${parsed.data.email}>\nTopic: ${parsed.data.topic}\n\n${parsed.data.message}`,
    });
  } catch (error) {
    console.error('[api/contact] email send failed:', error);
    return jsonResponse(
      { ok: false, error: 'Could not send your message right now. Please try again shortly.' },
      502
    );
  }

  return jsonResponse({ ok: true }, 200);
};
