/**
 * Oyun tarih/saatleri Europe/Berlin yerel saati olarak girilir ve gösterilir;
 * veritabanında UTC tutulur. Sunucu UTC'de çalıştığı için dönüşüm burada
 * açıkça yapılır (yeni bağımlılık yok, yaz/kış saati Intl'den gelir).
 */
export const GAME_TIME_ZONE = 'Europe/Berlin';

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: GAME_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const DISPLAY = new Intl.DateTimeFormat('tr-TR', {
  timeZone: GAME_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function berlinParts(instant: Date): { date: string; time: string } {
  const p: Record<string, string> = {};
  for (const part of PARTS.formatToParts(instant)) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Berlin'in o andaki UTC farkı (ms). */
function offsetMs(instant: Date): number {
  const { date, time } = berlinParts(instant);
  const wallClockAsUtc = Date.parse(`${date}T${time}:00Z`);
  return wallClockAsUtc - Math.floor(instant.getTime() / 60000) * 60000;
}

export function berlinLocalToUtc(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const guess = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(guess)) return null;
  // İlk tahminle farkı bul, sonra bulunan an için farkı yeniden hesapla
  // (yaz/kış saati geçişinin iki yanında fark değişir).
  const firstPass = guess - offsetMs(new Date(guess));
  const result = new Date(guess - offsetMs(new Date(firstPass)));
  // Var olmayan tarih (30 Şubat) ya da atlanan saat (ileri alınan gece) geri
  // çevrildiğinde aynı değeri vermez.
  const back = berlinParts(result);
  return back.date === date && back.time === time ? result : null;
}

export function formatGameDate(value: Date | string): string {
  return DISPLAY.format(new Date(value));
}

/** 90 → "1,5 saat" */
export function formatDurationHours(minutes: number): string {
  return `${String(minutes / 60).replace('.', ',')} saat`;
}

/** "14 Kasım 2026 Cumartesi 19:00–20:30 (1,5 saat)" */
export function formatGameTimeRange(startsAt: Date | string, durationMinutes: number): string {
  const start = new Date(startsAt);
  const end = berlinParts(new Date(start.getTime() + durationMinutes * 60_000));
  return `${formatGameDate(start)}–${end.time} (${formatDurationHours(durationMinutes)})`;
}
