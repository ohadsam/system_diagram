// Small color helpers for defaults/contrast — no dependency.

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/** Pick black or white text for readable contrast on a given background hex color. */
export function readableTextColor(hex) {
  if (!/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex || '')) return '#111827';
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111827' : '#F9FAFB';
}

export const PALETTE = [
  '#4F46E5', '#2563EB', '#0EA5E9', '#0D9488', '#16A34A',
  '#65A30D', '#CA8A04', '#EA580C', '#DC2626', '#DB2777',
  '#9333EA', '#475569', '#111827',
];
