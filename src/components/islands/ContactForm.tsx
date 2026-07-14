import { useEffect, useId, useRef, useState } from 'react';
import { createContactFormSchema, contactTopics, type ContactFormInput } from '../../core/services/contact-schema';
import type { Locale, Strings } from '../../i18n';

export interface ContactFormProps {
  turnstileSitekey: string;
  /** Current page locale (V3d addendum) — sent to POST /api/contact so server-side zod
   *  validation messages match the page's language, and used to pick this form's own dictionary. */
  locale: Locale;
  strings: Strings['contactForm'];
}

type FieldErrors = Partial<Record<keyof ContactFormInput, string>>;
type Status = 'idle' | 'submitting' | 'success' | 'error';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void }
      ) => string;
    };
  }
}

/**
 * Contact form island (spec section 7/11): name, email, topic, message, gated by
 * Turnstile + zod validation shared with POST /api/contact. Renders success/error
 * states via aria-live so screen reader users get the same feedback as sighted users.
 */
export default function ContactForm({ turnstileSitekey, locale, strings }: ContactFormProps) {
  const contactFormSchema = createContactFormSchema(locale);
  const formId = useId();
  const turnstileRef = useRef<HTMLDivElement>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [serverMessage, setServerMessage] = useState('');
  // Pre-selects the topic when a "Ways to work together" card links here with `?topic=...`
  // (contact/index.astro). Read client-side, not from an Astro prop: this site is fully static
  // (astro.config.mjs `output: 'static'`), so `Astro.url.searchParams` is always empty — there's
  // no request to read a query string from at prerender time. Starts at '' (matching SSR markup
  // exactly, so hydration doesn't warn) and is set once, after mount, from the real browser URL.
  // Controlled (not defaultValue) so this post-mount update actually reaches the <select>.
  const [selectedTopic, setSelectedTopic] = useState('');

  useEffect(() => {
    const urlTopic = new URLSearchParams(window.location.search).get('topic');
    if (urlTopic && (contactTopics as readonly string[]).includes(urlTopic)) {
      setSelectedTopic(urlTopic);
    }
  }, []);

  useEffect(() => {
    if (document.getElementById('cf-turnstile-script')) return;
    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    let cancelled = false;

    function tryRender() {
      if (cancelled || !turnstileRef.current || !window.turnstile) return;
      window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSitekey,
        callback: (token: string) => setTurnstileToken(token),
      });
    }

    const interval = setInterval(() => {
      if (window.turnstile) {
        tryRender();
        clearInterval(interval);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [turnstileSitekey]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setServerMessage('');

    const formData = new FormData(event.currentTarget);
    const input = {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      topic: String(formData.get('topic') ?? ''),
      message: String(formData.get('message') ?? ''),
      turnstileToken,
    };

    const parsed = contactFormSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContactFormInput;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setStatus('error');
      setServerMessage(fieldErrors.turnstileToken ?? strings.fixHighlightedFields);
      return;
    }

    setErrors({});

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed.data, locale }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setStatus('error');
        setServerMessage(result.error ?? strings.genericError);
        return;
      }

      setStatus('success');
      setServerMessage(strings.successMessage);
      (event.target as HTMLFormElement).reset();
      setTurnstileToken('');
    } catch {
      setStatus('error');
      setServerMessage(strings.networkError);
    }
  }

  if (status === 'success') {
    return (
      <div role="status" aria-live="polite" className="glass rounded-[var(--radius-md)] p-6 text-[var(--text)]">
        <p className="font-display text-lg font-semibold">{strings.successTitle}</p>
        <p className="mt-2 text-sm text-muted">{serverMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-name`} className="text-sm font-medium text-[var(--text)]">
          {strings.nameLabel}
        </label>
        <input
          id={`${formId}-name`}
          name="name"
          type="text"
          autoComplete="name"
          required
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${formId}-name-error` : undefined}
          className="glass min-h-11 rounded-[var(--radius-sm)] px-3 py-2 text-base text-[var(--text)] outline-none sm:text-sm"
        />
        {errors.name && (
          <p id={`${formId}-name-error`} className="text-xs text-[var(--warn)]">
            {errors.name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-email`} className="text-sm font-medium text-[var(--text)]">
          {strings.emailLabel}
        </label>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${formId}-email-error` : undefined}
          className="glass min-h-11 rounded-[var(--radius-sm)] px-3 py-2 text-base text-[var(--text)] outline-none sm:text-sm"
        />
        {errors.email && (
          <p id={`${formId}-email-error`} className="text-xs text-[var(--warn)]">
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-topic`} className="text-sm font-medium text-[var(--text)]">
          {strings.topicLabel}
        </label>
        <select
          id={`${formId}-topic`}
          name="topic"
          required
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          aria-invalid={Boolean(errors.topic)}
          aria-describedby={errors.topic ? `${formId}-topic-error` : undefined}
          className="glass min-h-11 rounded-[var(--radius-sm)] px-3 py-2 text-base text-[var(--text)] outline-none sm:text-sm"
        >
          <option value="" disabled>
            {strings.selectTopic}
          </option>
          {contactTopics.map((topic) => (
            <option key={topic} value={topic}>
              {strings.topics[topic]}
            </option>
          ))}
        </select>
        {errors.topic && (
          <p id={`${formId}-topic-error`} className="text-xs text-[var(--warn)]">
            {errors.topic}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-message`} className="text-sm font-medium text-[var(--text)]">
          {strings.messageLabel}
        </label>
        <textarea
          id={`${formId}-message`}
          name="message"
          rows={5}
          required
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? `${formId}-message-error` : undefined}
          className="glass min-h-11 rounded-[var(--radius-sm)] px-3 py-2 text-base text-[var(--text)] outline-none sm:text-sm"
        />
        {errors.message && (
          <p id={`${formId}-message-error`} className="text-xs text-[var(--warn)]">
            {errors.message}
          </p>
        )}
      </div>

      <div ref={turnstileRef} />

      {status === 'error' && (
        <p role="alert" aria-live="assertive" className="text-sm text-[var(--warn)]">
          {serverMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="border-beam rounded-[var(--radius-sm)] bg-[var(--accent)] accent-bg-image px-6 py-3 text-center font-semibold text-[var(--accent-contrast)] btn-interactive disabled:opacity-60"
      >
        {status === 'submitting' ? strings.sending : strings.send}
      </button>
    </form>
  );
}
