import { useEffect, useId, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import type { Strings } from '../../i18n';

/**
 * Brand mark glyph (Commit 2) — raster PNG (dual-gradient brain + arch).
 * Replaces the generative micro-brain SVG. Matches BaseLayout.astro's static shell.
 */
function BrandMarkIcon({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/brand-glyph.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { url: string; title: string }[];
}

const SESSION_KEY = 'fst-chat-history';
const LINKEDIN_URL = 'https://www.linkedin.com/in/felipe-tavares-';
const OPEN_EVENT = 'fst:open-chat';

export interface ChatWidgetProps {
  /** Chat-slice of the locale dictionary (V3d addendum), passed down from BaseLayout.astro so
   *  this island stays a pure function of props — no client-side locale detection. */
  strings: Strings['chat'];
}

function loadHistory(): UiMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UiMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: UiMessage[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage unavailable (private browsing, quota) — history just won't persist.
  }
}

/**
 * Chat widget island (spec section 8) — floating glass launcher + slide-in panel. Lazy-loaded
 * (`client:idle` from BaseLayout) so it costs zero JS before the browser is idle; a static
 * pre-hydration launcher shell (in BaseLayout markup) keeps the button visually present with no
 * pop-in once this island takes over. Conversation lives in sessionStorage only — no server-side
 * persistence, no PII storage (spec section 8/11).
 */
export default function ChatWidget({ strings }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>(() => (typeof window !== 'undefined' ? loadHistory() : []));
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'streaming' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const inputId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hides the pre-hydration static launcher shell once this island mounts, and listens for the
  // dossier "Ask my AI" trigger (spec: update dossier footer to open the widget).
  useEffect(() => {
    const staticLauncher = document.getElementById('chat-launcher-static');
    if (staticLauncher) staticLauncher.style.display = 'none';

    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener(OPEN_EVENT, handleOpenEvent);
    return () => window.removeEventListener(OPEN_EVENT, handleOpenEvent);
  }, []);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, status]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || status === 'streaming') return;

    const nextMessages: UiMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setStatus('streaming');
    setErrorMessage('');

    const controller = new AbortController();
    abortRef.current = controller;

    // Placeholder assistant message that gets filled in as SSE deltas arrive.
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          page: window.location.pathname,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({ error: undefined }));
        throw new Error(body.error ?? 'Something went wrong.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const eventLine = rawEvent.split('\n').find((l) => l.startsWith('event:'));
          const dataLine = rawEvent.split('\n').find((l) => l.startsWith('data:'));
          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.slice(6).trim();
          const data = JSON.parse(dataLine.slice(5).trim());

          if (eventName === 'delta') {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = { ...last, content: last.content + data.text };
              }
              return copy;
            });
          } else if (eventName === 'sources') {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = { ...last, sources: data.sources };
              }
              return copy;
            });
          } else if (eventName === 'error') {
            throw new Error(data.message);
          }
        }
      }

      setStatus('idle');
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      {/* Avatar launcher — circular avatar with brand glyph + bottom-right online dot.
          Replaces the pill button; same z-index/position/print-hidden behavior. The dot uses
          --online (token added to tokens.css) which is #22c55e in both themes (owner:
          "must always be green"). Mirrored by the static pre-hydration shell in BaseLayout. */}
      <button
        type="button"
        aria-label={open ? strings.launcherLabelClose : strings.launcherLabelOpen}
        aria-expanded={open}
        aria-controls="fst-chat-panel"
        onClick={() => setOpen((o) => !o)}
        className="border-beam overlay-surface glass btn-interactive btn-interactive--icon chat-safe-bottom chat-safe-right fixed z-40 flex h-14 w-14 min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--accent)] shadow-lg print:hidden"
      >
        {open ? (
          <X size={22} aria-hidden="true" />
        ) : (
          <span className="relative inline-flex">
            <BrandMarkIcon size={40} />
            {/* Online status dot — bottom-right of avatar, classic messenger badge idiom:
                green circle + page-background ring creates visual separation from avatar. */}
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg)]"
              style={{ background: 'var(--online)' }}
            />
          </span>
        )}
      </button>

      {open && (
        <div
          id="fst-chat-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={strings.title}
          className="overlay-surface glass fixed inset-x-0 bottom-0 z-40 flex h-[100dvh] flex-col sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[560px] sm:w-[380px] sm:rounded-[var(--radius-lg)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <header className="flex items-start justify-between gap-3 border-b border-[var(--border-glass)] px-4 py-3">
            <div>
              <p className="font-display text-base font-semibold text-[var(--text)]">{strings.title}</p>
              <p className="mt-0.5 text-xs text-muted">{strings.disclaimer}</p>
            </div>
            <button
              type="button"
              aria-label={strings.close}
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center text-muted hover:text-[var(--text)]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div
            className="flex-1 overflow-y-auto px-4 py-3"
            role="log"
            aria-live="polite"
            aria-label={strings.conversationLabel}
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col justify-end gap-2">
                <p className="mb-1 text-xs text-muted">{strings.tryAsking}</p>
                {strings.starters.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="glass min-h-11 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-[var(--text)] transition-colors duration-200 hover:text-[var(--accent)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <li key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={
                        m.role === 'user'
                          ? 'max-w-[85%] rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2 text-sm text-[var(--accent-contrast)]'
                          : 'max-w-[85%] rounded-[var(--radius-md)] bg-[var(--surface-glass-strong)] px-3 py-2 text-sm text-[var(--text)]'
                      }
                    >
                      <p className="whitespace-pre-wrap">{m.content || (status === 'streaming' ? '…' : '')}</p>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.sources.map((s) => (
                            <a
                              key={s.url}
                              href={s.url}
                              className="rounded-full border border-[var(--border-glass)] px-2 py-1 text-xs text-[var(--accent)] underline-offset-2 hover:underline"
                            >
                              {s.title}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {status === 'error' && (
              <p role="alert" className="mt-3 text-sm text-[var(--warn)]">
                {errorMessage}{' '}
                <a href={LINKEDIN_URL} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                  {strings.errorSuffix}
                </a>
              </p>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-[var(--border-glass)] p-3">
            <label htmlFor={inputId} className="sr-only">
              {strings.placeholder}
            </label>
            <textarea
              id={inputId}
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={strings.placeholder}
              disabled={status === 'streaming'}
              className="glass min-h-11 flex-1 resize-none rounded-[var(--radius-sm)] px-3 py-2 text-base text-[var(--text)] outline-none sm:text-sm"
            />
            <button
              type="submit"
              aria-label={strings.send}
              disabled={status === 'streaming' || !input.trim()}
              className="border-beam btn-interactive btn-interactive--icon inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] disabled:opacity-60"
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
