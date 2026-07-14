import type { EmailMessage, EmailSender } from '../../core/ports/email-sender';

/**
 * Dev-only EmailSender adapter — logs the message instead of sending it, so
 * the contact form is testable locally without a RESEND_API_KEY. Used
 * automatically by /api/contact when the key is absent (see src/pages/api/contact.ts).
 */
export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.log('[dev email adapter] would send email:', {
      from: message.from,
      to: message.to,
      subject: message.subject,
      body: message.body,
    });
  }
}
