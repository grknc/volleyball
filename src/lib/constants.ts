export const PLAYER_POSITIONS = ['Pasör', 'Çaprazcı', 'Smaçör', 'Orta Oyuncu', 'Libero'] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export function isValidPlayerPosition(value: unknown): value is PlayerPosition {
  return typeof value === 'string' && (PLAYER_POSITIONS as readonly string[]).includes(value);
}

export function isValidAvatarUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
