import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getTheme, toggleTheme as toggleThemeShared } from '../../lib/theme';

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme);

  return (
    <button
      type="button"
      onClick={() => setThemeState(toggleThemeShared())}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="glass btn-interactive btn-interactive--icon inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--text)] transition-colors duration-200 hover:text-[var(--accent)]"
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
