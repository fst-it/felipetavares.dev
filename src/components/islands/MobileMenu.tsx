import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { NavLink } from '../../config/nav';

export interface MobileMenuProps {
  links: NavLink[];
  bookACallHref: string;
  bookACallLabel: string;
}

export default function MobileMenu({ links, bookACallHref, bookACallLabel }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((o) => !o)}
        className="glass btn-interactive inline-flex h-11 w-11 items-center justify-center rounded-full"
      >
        {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
      </button>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="overlay-surface glass absolute inset-x-4 top-16 z-50 flex flex-col gap-1 rounded-[var(--radius-md)] p-4"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius-sm)] px-3 py-2 text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-glass-strong)] hover:text-[var(--accent)]"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href={bookACallHref}
            className="border-beam btn-interactive accent-bg-image mt-2 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-center font-medium text-[var(--accent-contrast)]"
            onClick={() => setOpen(false)}
          >
            {bookACallLabel}
          </a>
        </nav>
      )}
    </div>
  );
}
