// Tarayıcıda çalışır. localStorage kapalı olabilir (gizli pencere, engellenmiş
// site verisi); bu durumda kayıtlar yalnızca bellekte tutulur — katılma yine
// çalışır, sayfa yenilenince "Ayrıl" düğmesi ve yönetim kutusu kaybolur.

export interface LeaveRecord {
  participantId: string;
  token: string;
}

const manageKey = (gameId: string) => `oyun:${gameId}:manage`;
const leaveKey = (gameId: string) => `oyun:${gameId}:leave`;

// localStorage kullanılamazsa sayfa içi gezinmeler boyunca bellekte tutulur;
// böylece oyun oluşturulduktan hemen sonra yönetim bağlantısı yine görünür.
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    // yoksay
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // yoksay
  }
}

export function readManageToken(gameId: string): string | null {
  return read(manageKey(gameId));
}

export function saveManageToken(gameId: string, token: string): void {
  write(manageKey(gameId), token);
}

export function readLeave(gameId: string): LeaveRecord | null {
  const raw = read(leaveKey(gameId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LeaveRecord>;
    return typeof parsed.participantId === 'string' && typeof parsed.token === 'string'
      ? { participantId: parsed.participantId, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

export function saveLeave(gameId: string, record: LeaveRecord): void {
  write(leaveKey(gameId), JSON.stringify(record));
}

export function clearLeave(gameId: string): void {
  write(leaveKey(gameId), null);
}
