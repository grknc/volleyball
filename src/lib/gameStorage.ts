// Tarayıcıda çalışır. localStorage kapalı olabilir (gizli pencere, engellenmiş
// site verisi); bu durumda sessizce boş döner — katılma yine çalışır, yalnızca
// sayfa yenilenince "Ayrıl" düğmesi kaybolur.

export interface LeaveRecord {
  participantId: string;
  token: string;
}

const manageKey = (gameId: string) => `oyun:${gameId}:manage`;
const leaveKey = (gameId: string) => `oyun:${gameId}:leave`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
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
