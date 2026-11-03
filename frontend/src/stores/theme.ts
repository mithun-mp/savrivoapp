import { atom } from 'nanostores';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'savrivo-theme';

export const themeStore = atom<Theme>('light');

export function initTheme(): void {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  const preferred: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme: Theme = (stored === 'light' || stored === 'dark') ? stored : preferred;
  themeStore.set(theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function toggleTheme(): void {
  const next: Theme = themeStore.get() === 'light' ? 'dark' : 'light';
  themeStore.set(next);

  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('theme-transition');
    document.documentElement.setAttribute('data-theme', next);
    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 280);
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, next);
  }
}

