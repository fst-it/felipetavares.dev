import type { EmailMessage, EmailSender } from '../../core/ports/email-sender';

/**
 * Production EmailSender adapter — Resend REST API (spec section 4/11).
 * Key comes from the RESEND_API_KEY Cloudflare env binding; never bundled client-side.
 */
export class ResendEmailSender implements EmailSender {
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.body,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend API error (${response.status}): ${detail}`);
    }
  }
}
