/**
 * Server-side Cloudflare Turnstile verification (spec section 11). Pure fetch
 * wrapper — no framework/adapter imports, so it's usable from any API route.
 */
export async function verifyTurnstileToken(
  token: string,
  secret: string,
  remoteIp?: string
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) return false;
  const result = (await response.json()) as { success: boolean };
  return result.success === true;
}
