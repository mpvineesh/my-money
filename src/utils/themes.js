// App theme registry. Keep the `primary`/`accent`/`tint` values in sync with the
// matching `--brand-500` / `--brand-accent` / `--brand-50` in styles/themes.css.
// `primary` is also passed to charts (recharts strokes), where CSS variables in SVG
// presentation attributes do not resolve.

export const THEMES = [
  { id: 'indigo', label: 'Indigo', primary: '#6366f1', accent: '#8b5cf6', tint: '#eef2ff' },
  { id: 'emerald', label: 'Emerald', primary: '#059669', accent: '#0d9488', tint: '#ecfdf5' },
  { id: 'sunset', label: 'Sunset', primary: '#e11d48', accent: '#f97316', tint: '#fff1f2' },
  { id: 'ocean', label: 'Ocean', primary: '#0284c7', accent: '#06b6d4', tint: '#f0f9ff' },
];

export const DEFAULT_THEME = 'indigo';

export const THEME_IDS = THEMES.map((theme) => theme.id);

export function getThemeInfo(themeId) {
  return THEMES.find((theme) => theme.id === themeId) || THEMES[0];
}
