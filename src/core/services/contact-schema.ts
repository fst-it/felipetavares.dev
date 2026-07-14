import { z } from 'zod';
import { en } from '../../i18n/en';
import { ptBr } from '../../i18n/pt-br';
import type { Locale } from '../../i18n';

// V5a fix 11 (copy pass — collaboration framing): "Role opportunity" recast to "Exchanging ideas"
// so the topic list reads as mutual-value options rather than solely job-seeking, since Felipe is
// currently employed and the site should never read otherwise.
export const contactTopics = ['Speaking', 'Advisory', 'Exchanging ideas', 'Other'] as const;

const dictionaries = { en, 'pt-br': ptBr };

/**
 * Shared client + server validation for the contact form (spec section 7/11), parameterized by
 * locale (V3d addendum) so validation messages match the page's language. The `topic` enum's
 * underlying values stay the fixed EN keys above regardless of locale (they're what's persisted/
 * emailed and matched against `<option value>` in ContactForm.tsx) — only the messages and the
 * `<option>` display labels are translated.
 */
export function createContactFormSchema(locale: Locale = 'en') {
  const strings = dictionaries[locale].contactForm;
  return z.object({
    name: z.string().trim().min(1, strings.validation.nameRequired).max(120, strings.validation.nameTooLong),
    email: z.email(strings.validation.emailInvalid).trim().min(1, strings.validation.emailRequired),
    topic: z.enum(contactTopics, { message: strings.validation.topicRequired }),
    message: z
      .string()
      .trim()
      .min(10, strings.validation.messageTooShort)
      .max(4000, strings.validation.messageTooLong),
    turnstileToken: z.string().min(1, strings.validation.verificationRequired),
  });
}

/** EN default — used wherever a locale isn't in scope (e.g. existing e2e specs). */
export const contactFormSchema = createContactFormSchema('en');

export type ContactFormInput = z.infer<ReturnType<typeof createContactFormSchema>>;
