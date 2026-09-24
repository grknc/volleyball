'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { LevelBadge } from '@/components/LevelBadge';
import type { AttendancePlayer, RsvpChoice, SetAttendanceResult, WeekAttendance } from '@/lib/attendance';
import { CAPACITY_MAX, CAPACITY_MIN, CAPACITY_PRESETS, capacityLabel } from '@/lib/capacity';

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

type Status = 'yes' | 'wait' | 'no' | 'none';

function statusOf(att: WeekAttendance, playerId: string): Status {
  if (att.coming.some((p) => p.id === playerId)) return 'yes';
  if (att.waitlist.some((p) => p.id === playerId)) return 'wait';
  if (att.notComing.some((p) => p.id === playerId)) return 'no';
  return 'none';
}

function waitPosition(att: WeekAttendance, playerId: string): number {
  return att.waitlist.findIndex((p) => p.id === playerId) + 1;
}

function isFull(att: WeekAttendance): boolean {
  return att.capacity !== null && att.coming.length >= att.capacity;
}

async function send(
  url: string,
  playerId: string,
  choice: RsvpChoice
): Promise<{ attendance: WeekAttendance; result: SetAttendanceResult }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, choice }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Kaydedilemedi');
  return data;
}

function Chip({ p, tone, index }: { p: AttendancePlayer; tone: 'yes' | 'wait' | 'no' | 'none'; index?: number }) {
  const ring =
    tone === 'yes'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'wait'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'no'
          ? 'border-rose-200 bg-rose-50'
          : 'border-slate-200 bg-white';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border pl-0.5 pr-1.5 py-0.5 text-xs ${ring}`}>
      {index !== undefined && (
        <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold flex items-center justify-center">
          {index}
        </span>
      )}
      <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} sizeClassName="w-5 h-5" />
      <span className={tone === 'no' ? 'text-slate-500 line-through decoration-rose-300' : 'text-slate-800'}>{p.name}</span>
      {(tone === 'yes' || tone === 'wait') && <LevelBadge level={p.rating} size="xs" />}
    </span>
  );
}

function Counts({ att }: { att: WeekAttendance }) {
  const cells = [
    {
      value: att.capacity !== null ? `${att.coming.length}/${att.capacity}` : String(att.coming.length),
      label: 'Geliyor',
      cls: 'bg-emerald-50 text-emerald-700',
    },
    ...(att.capacity !== null || att.waitlist.length > 0
      ? [{ value: String(att.waitlist.length), label: 'Yedek', cls: 'bg-amber-50 text-amber-700' }]
      : []),
    { value: String(att.notComing.length), label: 'Gelmiyor', cls: 'bg-rose-50 text-rose-600' },
    { value: String(att.noResponse.length), label: 'Yanıt yok', cls: 'bg-slate-100 text-slate-600' },
  ];
  return (
    <div className={`grid gap-2 text-center ${cells.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {cells.map((c) => (
        <div key={c.label} className={`rounded-xl py-2 ${c.cls}`}>
          <p className="text-2xl font-extrabold tabular-nums">{c.value}</p>
          <p className="text-[11px]">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

function CapacityBar({ att }: { att: WeekAttendance }) {
  if (att.capacity === null) return null;
  const pct = Math.min(100, (att.coming.length / att.capacity) * 100);
  const left = att.capacity - att.coming.length;
  return (
    <div className="mt-3">
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${left <= 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-600 mt-1">
        {left > 0
          ? `${att.capacity} kişilik kontenjan · ${left} yer kaldı`
          : `Kontenjan doldu · yeni “Geliyorum” diyenler yedek listesine yazılır`}
      </p>
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

function Lists({ att, showNoResponse }: { att: WeekAttendance; showNoResponse: boolean }) {
  return (
    <div className="mt-4 space-y-3">
      <Formats att={att} />
      {att.coming.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {att.coming.map((p) => (
            <Chip key={p.id} p={p} tone="yes" />
          ))}
        </div>
      )}
      {att.waitlist.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-800 mb-1">Yedek listesi</p>
          <div className="flex flex-wrap gap-1.5">
            {att.waitlist.map((p, i) => (
              <Chip key={p.id} p={p} tone="wait" index={i + 1} />
            ))}
          </div>
        </div>
      )}
      {att.notComing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {att.notComing.map((p) => (
            <Chip key={p.id} p={p} tone="no" />
          ))}
        </div>
      )}
      {showNoResponse && att.noResponse.length > 0 && (
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
    () =>
      [...att.coming, ...att.waitlist, ...att.notComing, ...att.noResponse].sort((a, b) =>
        a.name.localeCompare(b.name, 'tr')
      ),
    [att]
  );
  const myStatus: Status = me ? statusOf(att, me) : 'none';
  const locked = me ? att.lockedPlayerIds.includes(me) : false;
  const meName = everyone.find((p) => p.id === me)?.name;
  const full = isFull(att);

  async function answer(choice: RsvpChoice) {
    if (!me) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { attendance, result } = await send(`/api/weeks/${att.weekId}/attendance`, me, choice);
      setAtt(attendance);
      const promoted = result.promotedNames.length
        ? ` Yedekten katılımcı oldu: ${result.promotedNames.join(', ')}.`
        : '';
      if (result.outcome === 'confirmed') setMessage('Harika, görüşürüz! 🏐');
      else if (result.outcome === 'waitlisted')
        setMessage(
          `Kontenjan dolu — yedek listesinde ${result.waitlistPosition}. sıradasın. Yer açılırsa otomatik katılımcı olursun.`
        );
      else if (result.outcome === 'declined') setMessage(`Tamam, bir dahaki sefere!${promoted}`);
      else setMessage(`Yanıtın geri alındı.${promoted}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const statusText =
    myStatus === 'yes'
      ? 'Geliyor ✅'
      : myStatus === 'wait'
        ? `Yedek listesinde ${waitPosition(att, me)}. sırada ⏳`
        : myStatus === 'no'
          ? 'Gelmiyor ❌'
          : 'Henüz yanıt vermedi';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Katılım</h2>
        <span
          className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
            !att.open ? 'bg-slate-100 text-slate-600' : full ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {!att.open ? 'BİLDİRİM KAPALI' : full ? 'DOLU · YEDEK ALINIYOR' : 'BİLDİRİM AÇIK'}
        </span>
      </div>

      <Counts att={att} />
      <CapacityBar att={att} />

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
                {meName}: <strong>{statusText}</strong>
              </p>
              {locked ? (
                <p className="text-xs text-amber-700 mt-2">
                  Takımlar kuruldu ve sen bir takımdasın. Değişiklik için organizatöre haber ver.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    disabled={busy || myStatus === 'yes' || myStatus === 'wait'}
                    onClick={() => answer('yes')}
                    className={`rounded-xl text-white font-bold py-2.5 disabled:opacity-40 ${
                      full && myStatus !== 'yes' ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}
                  >
                    {full && myStatus !== 'yes' ? 'Yedeğe Yazıl' : 'Geliyorum'}
                  </button>
                  <button
                    type="button"
                    disabled={busy || myStatus === 'no'}
                    onClick={() => answer('no')}
                    className="rounded-xl bg-white border border-rose-300 text-rose-700 font-bold py-2.5 disabled:opacity-40"
                  >
                    Gelmiyorum
                  </button>
                  {myStatus !== 'none' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => answer('none')}
                      className="col-span-2 text-xs text-slate-500 underline"
                    >
                      {myStatus === 'wait' ? 'Yedek listesinden çık' : 'Yanıtımı geri al'}
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

      <Lists att={att} showNoResponse={att.open} />
    </section>
  );
}

/** Admin: kontenjan ayarı + her oyuncu için durum seçici. */
export function AdminAttendancePanel({ initial }: { initial: WeekAttendance }) {
  const router = useRouter();
  const [att, setAtt] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [capacityInput, setCapacityInput] = useState(initial.capacity?.toString() ?? '');

  const everyone = useMemo(
    () =>
      [...att.coming, ...att.waitlist, ...att.notComing, ...att.noResponse].sort((a, b) =>
        a.name.localeCompare(b.name, 'tr')
      ),
    [att]
  );

  async function change(playerId: string, choice: RsvpChoice) {
    setBusyId(playerId);
    setError(null);
    setInfo(null);
    try {
      const { attendance, result } = await send(`/api/admin/weeks/${att.weekId}/attendance`, playerId, choice);
      setAtt(attendance);
      if (result.promotedNames.length) setInfo(`Yedekten katılımcı oldu: ${result.promotedNames.join(', ')}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveCapacity(value: number | null) {
    setError(null);
    setInfo(null);
    setBusyId('capacity');
    try {
      const res = await fetch(`/api/admin/weeks/${att.weekId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Kontenjan kaydedilemedi');
      const fresh = await fetch(`/api/admin/weeks/${att.weekId}/attendance`).then((r) => r.json());
      setAtt(fresh.attendance);
      setCapacityInput(value?.toString() ?? '');
      setInfo(
        `Kontenjan: ${value ?? 'sınırsız'}${data.promoted ? ` · ${data.promoted} yedek katılımcı oldu` : ''}`
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const OPTIONS: Array<{ value: RsvpChoice; label: string; active: string; title: string }> = [
    { value: 'yes', label: '✅', active: 'bg-emerald-600 text-white', title: 'Katılımcı (kontenjanı aşabilir)' },
    { value: 'no', label: '❌', active: 'bg-rose-500 text-white', title: 'Gelmiyor' },
    { value: 'none', label: '–', active: 'bg-slate-600 text-white', title: 'Yanıt yok' },
  ];

  const overCapacity = att.capacity !== null && att.coming.length > att.capacity;

  return (
    <section className="mt-6 mb-6 rounded-xl border p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Katılım ({att.coming.length} geliyor)</h2>
        <span className="text-xs text-slate-500">
          {att.open ? 'Oyuncular bildirim yapabiliyor' : 'Oyuncu bildirimi için haftayı “Yayında” yap'}
        </span>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 mb-3">
        <p className="text-sm font-semibold mb-2">Kontenjan</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {CAPACITY_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={busyId === 'capacity'}
              onClick={() => saveCapacity(c)}
              className={`text-xs rounded-md px-2 py-1 border ${
                att.capacity === c ? 'bg-blue-700 text-white border-blue-700' : 'bg-white border-slate-300'
              }`}
            >
              {capacityLabel(c)}
            </button>
          ))}
          <button
            type="button"
            disabled={busyId === 'capacity'}
            onClick={() => saveCapacity(null)}
            className={`text-xs rounded-md px-2 py-1 border ${
              att.capacity === null ? 'bg-blue-700 text-white border-blue-700' : 'bg-white border-slate-300'
            }`}
          >
            Sınırsız
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={CAPACITY_MIN}
            max={CAPACITY_MAX}
            value={capacityInput}
            onChange={(e) => setCapacityInput(e.target.value)}
            placeholder="Özel"
            className="border rounded px-2 py-1 w-24 text-sm"
          />
          <button
            type="button"
            disabled={busyId === 'capacity' || capacityInput === ''}
            onClick={() => saveCapacity(Number(capacityInput))}
            className="text-sm bg-slate-900 text-white rounded px-3 py-1 disabled:opacity-50"
          >
            Kaydet
          </button>
        </div>
        {overCapacity && (
          <p className="text-xs text-amber-700 mt-2">
            ⚠️ Katılımcı sayısı kontenjanın üstünde. Kimse otomatik çıkarılmaz; gerekirse elle düzenle.
          </p>
        )}
      </div>

      <Counts att={att} />
      <CapacityBar att={att} />
      <div className="mt-3">
        <Formats att={att} />
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      {info && <p className="text-emerald-700 text-sm mt-2">{info}</p>}
      <ul className="mt-3 divide-y">
        {everyone.map((p) => {
          const status = statusOf(att, p.id);
          const locked = att.lockedPlayerIds.includes(p.id);
          return (
            <li key={p.id} className="flex items-center gap-2 py-1.5">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} sizeClassName="w-7 h-7" />
              <span className="flex-1 text-sm">
                {p.name} <span className="text-xs text-slate-500">{p.position ?? ''}</span>
                {locked && <span className="ml-1 text-[10px] text-blue-700">(takımda)</span>}
                {status === 'wait' && (
                  <span className="ml-1 text-[10px] font-bold rounded bg-amber-100 text-amber-800 px-1">
                    Yedek #{waitPosition(att, p.id)}
                  </span>
                )}
              </span>
              <LevelBadge level={p.rating} size="xs" />
              <div className="flex rounded-lg border overflow-hidden">
                {OPTIONS.map((o) => {
                  const active = status === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => !active && change(p.id, o.value)}
                      className={`w-8 h-7 text-xs ${active ? o.active : 'bg-white hover:bg-slate-50'}`}
                      title={o.value === 'yes' && status === 'wait' ? 'Yedekten katılımcı yap' : o.title}
                      aria-label={`${p.name}: ${o.title}`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
