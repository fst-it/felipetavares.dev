export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  body: string;
}

/**
 * Typed contract only — no adapter implements this yet. Backs the contact form
 * (phase 2) once Resend is wired up.
 */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
