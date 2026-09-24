'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { LevelBadge } from '@/components/LevelBadge';
import type { AttendancePlayer, RsvpChoice, WeekAttendance } from '@/lib/attendance';

const ME_KEY = 'voleybol.me';

function readMe(): string {
  try {
    return window.localStorage.getItem(ME_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeMe(id: string) {
  try {
    window.localStorage.setItem(ME_KEY, id);
  } catch {
    /* depolama kapalıysa sorun değil */
  }
}

function choiceOf(att: WeekAttendance, playerId: string): RsvpChoice {
  if (att.coming.some((p) => p.id === playerId)) return 'yes';
  if (att.notComing.some((p) => p.id === playerId)) return 'no';
  return 'none';
}

async function send(url: string, playerId: string, choice: RsvpChoice): Promise<WeekAttendance> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, choice }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Kaydedilemedi');
  return data.attendance as WeekAttendance;
}

function Chip({ p, tone }: { p: AttendancePlayer; tone: 'yes' | 'no' | 'none' }) {
  const ring = tone === 'yes' ? 'border-emerald-200 bg-emerald-50' : tone === 'no' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border pl-0.5 pr-1.5 py-0.5 text-xs ${ring}`}>
      <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} sizeClassName="w-5 h-5" />
      <span className={tone === 'no' ? 'text-slate-500 line-through decoration-rose-300' : 'text-slate-800'}>{p.name}</span>
      {tone === 'yes' && <LevelBadge level={p.rating} size="xs" />}
    </span>
  );
}

function Counts({ att }: { att: WeekAttendance }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-emerald-50 py-2">
        <p className="text-2xl font-extrabold text-emerald-700">{att.coming.length}</p>
        <p className="text-[11px] text-emerald-800">Geliyor</p>
      </div>
      <div className="rounded-xl bg-rose-50 py-2">
        <p className="text-2xl font-extrabold text-rose-600">{att.notComing.length}</p>
        <p className="text-[11px] text-rose-700">Gelmiyor</p>
      </div>
      <div className="rounded-xl bg-slate-100 py-2">
        <p className="text-2xl font-extrabold text-slate-600">{att.noResponse.length}</p>
        <p className="text-[11px] text-slate-600">Yanıt yok</p>
      </div>
    </div>
  );
}

function Formats({ att }: { att: WeekAttendance }) {
  if (att.coming.length < 4) {
    return (
      <p className="text-xs text-slate-500">
        Maç için en az 4 kişi gerekiyor{att.coming.length > 0 ? ` — ${4 - att.coming.length} kişi daha` : ''}.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-slate-500">{att.coming.length} kişiyle:</span>
      {att.formats.map((f) => (
        <span key={f.label} className="rounded-md bg-blue-50 text-blue-800 font-semibold px-2 py-0.5">
          {f.label}
        </span>
      ))}
    </div>
  );
}

/** Herkese açık katılım kartı: oyuncu kendini seçip Geliyorum / Gelmiyorum der. */
export function AttendancePanel({ initial }: { initial: WeekAttendance }) {
  const [att, setAtt] = useState(initial);
  const [me, setMe] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setMe(readMe()), []);

  const everyone = useMemo(
    () => [...att.coming, ...att.notComing, ...att.noResponse].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [att]
  );
  const myChoice = me ? choiceOf(att, me) : 'none';
  const locked = me ? att.lockedPlayerIds.includes(me) : false;
  const meName = everyone.find((p) => p.id === me)?.name;

  async function answer(choice: RsvpChoice) {
    if (!me) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setAtt(await send(`/api/weeks/${att.weekId}/attendance`, me, choice));
      setMessage(choice === 'yes' ? 'Harika, görüşürüz! 🏐' : choice === 'no' ? 'Tamam, bir dahaki sefere!' : 'Yanıtın geri alındı.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Katılım</h2>
        <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${att.open ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
          {att.open ? 'BİLDİRİM AÇIK' : 'BİLDİRİM KAPALI'}
        </span>
      </div>

      <Counts att={att} />

      {att.open && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="rsvp-me">
            Sen kimsin?
          </label>
          <select
            id="rsvp-me"
            value={me}
            onChange={(e) => {
              setMe(e.target.value);
              writeMe(e.target.value);
              setError(null);
              setMessage(null);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">İsmini seç…</option>
            {everyone.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {me && (
            <>
              <p className="text-xs text-slate-600 mt-2">
                {meName}:{' '}
                <strong>{myChoice === 'yes' ? 'Geliyor ✅' : myChoice === 'no' ? 'Gelmiyor ❌' : 'Henüz yanıt vermedi'}</strong>
              </p>
              {locked ? (
                <p className="text-xs text-amber-700 mt-2">
                  Takımlar kuruldu ve sen bir takımdasın. Değişiklik için organizatöre haber ver.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    disabled={busy || myChoice === 'yes'}
                    onClick={() => answer('yes')}
                    className="rounded-xl bg-emerald-600 text-white font-bold py-2.5 disabled:opacity-40"
                  >
                    Geliyorum
                  </button>
                  <button
                    type="button"
                    disabled={busy || myChoice === 'no'}
                    onClick={() => answer('no')}
                    className="rounded-xl bg-white border border-rose-300 text-rose-700 font-bold py-2.5 disabled:opacity-40"
                  >
                    Gelmiyorum
                  </button>
                  {myChoice !== 'none' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => answer('none')}
                      className="col-span-2 text-xs text-slate-500 underline"
                    >
                      Yanıtımı geri al
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {message && <p className="text-xs text-emerald-700 mt-2">{message}</p>}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <Formats att={att} />
        {att.coming.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {att.coming.map((p) => (
              <Chip key={p.id} p={p} tone="yes" />
            ))}
          </div>
        )}
        {att.notComing.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {att.notComing.map((p) => (
              <Chip key={p.id} p={p} tone="no" />
            ))}
          </div>
        )}
        {att.open && att.noResponse.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500">Yanıt vermeyenler ({att.noResponse.length})</summary>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {att.noResponse.map((p) => (
                <Chip key={p.id} p={p} tone="none" />
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

/** Admin: her oyuncu için 3 durumlu seçici. */
export function AdminAttendancePanel({ initial }: { initial: WeekAttendance }) {
  const router = useRouter();
  const [att, setAtt] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const everyone = useMemo(
    () => [...att.coming, ...att.notComing, ...att.noResponse].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [att]
  );

  async function change(playerId: string, choice: RsvpChoice) {
    setBusyId(playerId);
    setError(null);
    try {
      setAtt(await send(`/api/admin/weeks/${att.weekId}/attendance`, playerId, choice));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const OPTIONS: Array<{ value: RsvpChoice; label: string; active: string }> = [
    { value: 'yes', label: '✅', active: 'bg-emerald-600 text-white' },
    { value: 'no', label: '❌', active: 'bg-rose-500 text-white' },
    { value: 'none', label: '–', active: 'bg-slate-600 text-white' },
  ];

  return (
    <section className="mt-6 mb-6 rounded-xl border p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Katılım ({att.coming.length} geliyor)</h2>
        <span className="text-xs text-slate-500">
          {att.open ? 'Oyuncular bildirim yapabiliyor' : 'Oyuncu bildirimi için haftayı “Yayında” yap'}
        </span>
      </div>
      <Counts att={att} />
      <div className="mt-3">
        <Formats att={att} />
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <ul className="mt-3 divide-y">
        {everyone.map((p) => {
          const current = choiceOf(att, p.id);
          const locked = att.lockedPlayerIds.includes(p.id);
          return (
            <li key={p.id} className="flex items-center gap-2 py-1.5">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} sizeClassName="w-7 h-7" />
              <span className="flex-1 text-sm">
                {p.name} <span className="text-xs text-slate-500">{p.position ?? ''}</span>
                {locked && <span className="ml-1 text-[10px] text-blue-700">(takımda)</span>}
              </span>
              <LevelBadge level={p.rating} size="xs" />
              <div className="flex rounded-lg border overflow-hidden">
                {OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => current !== o.value && change(p.id, o.value)}
                    className={`w-8 h-7 text-xs ${current === o.value ? o.active : 'bg-white hover:bg-slate-50'}`}
                    aria-label={`${p.name}: ${o.value}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
