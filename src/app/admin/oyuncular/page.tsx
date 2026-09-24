'use client';

import { useEffect, useMemo, useState } from 'react';
import { PLAYER_POSITIONS } from '@/lib/constants';
import { formatLevel } from '@/lib/rating';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { LevelBadge } from '@/components/LevelBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Player {
  id: string;
  name: string;
  level: number;
  rating: number;
  matches: number;
  weeks: number;
  mvps: number;
  position: string | null;
  heightCm: number | null;
  avatarUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

type Filter = 'all' | 'active' | 'passive' | 'nomatch';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'passive', label: 'Pasif' },
  { key: 'nomatch', label: 'Hiç maç oynamamış' },
];

/** "5,5" ya da "5.5" → 5.5 */
function parseLevel(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && text.trim() !== '' ? n : null;
}

const levelText = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: 'single'; player: Player }
    | { kind: 'bulk'; ids: string[] }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await api('/api/admin/players', 'GET');
    setPlayers(data.players ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(
    () => ({
      all: players.length,
      active: players.filter((p) => p.isActive).length,
      passive: players.filter((p) => !p.isActive).length,
      nomatch: players.filter((p) => p.matches === 0).length,
    }),
    [players]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr');
    return players.filter((p) => {
      if (term && !p.name.toLocaleLowerCase('tr').includes(term)) return false;
      if (filter === 'active') return p.isActive;
      if (filter === 'passive') return !p.isActive;
      if (filter === 'nomatch') return p.matches === 0;
      return true;
    });
  }, [players, search, filter]);

  const selectedPlayers = players.filter((p) => selected.has(p.id));
  const selectedWithMatches = selectedPlayers.filter((p) => p.matches > 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const allSelected = visible.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  async function setActive(player: Player, isActive: boolean) {
    setError(null);
    const r = await api(`/api/admin/players/${player.id}`, 'PATCH', { isActive });
    if (!r.ok) return setError(r.data.error ?? 'Güncellenemedi');
    setToast(`${player.name} ${isActive ? 'aktif yapıldı' : 'pasife alındı'}`);
    load();
  }

  async function deleteOne(player: Player) {
    setBusy(true);
    setError(null);
    const r = await api(`/api/admin/players/${player.id}${player.matches > 0 ? '?force=1' : ''}`, 'DELETE');
    setBusy(false);
    setConfirm(null);
    if (!r.ok) return setError(r.data.message ?? r.data.error ?? 'Silinemedi');
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(player.id);
      return next;
    });
    setToast(`${player.name} silindi${r.data.promoted ? ` · ${r.data.promoted} yedek katılımcı oldu` : ''}`);
    load();
  }

  async function deleteBulk(ids: string[]) {
    setBusy(true);
    setError(null);
    let ok = 0;
    const failed: string[] = [];
    for (const id of ids) {
      const p = players.find((x) => x.id === id);
      const r = await api(`/api/admin/players/${id}`, 'DELETE');
      if (r.ok) ok++;
      else failed.push(p?.name ?? id);
    }
    setBusy(false);
    setConfirm(null);
    setSelected(new Set());
    setToast(`${ok} oyuncu silindi`);
    if (failed.length) setError(`Silinemedi: ${failed.join(', ')}`);
    load();
  }

  async function passivateBulk(ids: string[]) {
    setBusy(true);
    for (const id of ids) await api(`/api/admin/players/${id}`, 'PATCH', { isActive: false });
    setBusy(false);
    setSelected(new Set());
    setToast(`${ids.length} oyuncu pasife alındı`);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Oyuncular</h1>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="bg-slate-900 text-white rounded px-3 py-1.5 text-sm"
        >
          {showAdd ? 'Kapat' : '+ Yeni Oyuncu'}
        </button>
      </div>

      {showAdd && (
        <AddPlayerForm
          onAdded={(name) => {
            setToast(`${name} eklendi`);
            load();
          }}
        />
      )}

      {toast && <p className="mb-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2">✓ {toast}</p>}
      {error && <p className="mb-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İsim ara…"
          className="border rounded px-2 py-1.5 text-sm flex-1 min-w-[160px]"
        />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              filter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 shadow-sm">
          <span className="text-sm font-semibold">{selected.size} oyuncu seçildi</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => passivateBulk(Array.from(selected))}
            className="text-sm border rounded px-2 py-1"
          >
            Pasife al
          </button>
          <button
            type="button"
            disabled={busy || selectedWithMatches.length > 0}
            onClick={() => setConfirm({ kind: 'bulk', ids: Array.from(selected) })}
            className="text-sm rounded px-2 py-1 bg-red-600 text-white disabled:opacity-40"
            title={selectedWithMatches.length > 0 ? 'Maç geçmişi olan oyuncular toplu silinemez' : undefined}
          >
            Seçilenleri sil
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm underline text-slate-600">
            Seçimi temizle
          </button>
          {selectedWithMatches.length > 0 && (
            <span className="text-xs text-amber-700 w-full">
              Seçimde maç oynamış {selectedWithMatches.length} oyuncu var ({selectedWithMatches.map((p) => p.name).join(', ')}).
              Bunları tek tek silebilir ya da pasife alabilirsin.
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="py-2 pr-2">
                  <input
                    type="checkbox"
                    aria-label="Görünenlerin tümünü seç"
                    checked={visible.length > 0 && visible.every((p) => selected.has(p.id))}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th className="py-2">Oyuncu</th>
                <th className="py-2">Güncel Seviye</th>
                <th className="py-2">Başlangıç</th>
                <th className="py-2">Maç</th>
                <th className="py-2">Pozisyon</th>
                <th className="py-2">Durum</th>
                <th className="py-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) =>
                editingId === p.id ? (
                  <tr key={p.id} className="border-b bg-blue-50/40">
                    <td colSpan={8} className="py-3">
                      <EditPlayerForm
                        player={p}
                        onCancel={() => setEditingId(null)}
                        onSaved={(msg) => {
                          setEditingId(null);
                          setToast(msg);
                          load();
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className={`border-b ${p.isActive ? '' : 'opacity-60'}`}>
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        aria-label={`${p.name} seç`}
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                      />
                    </td>
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} sizeClassName="w-8 h-8" />
                        <span>
                          <span className="font-medium">{p.name}</span>
                          {p.notes && <span className="block text-xs text-slate-500">{p.notes}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="py-2">
                      <LevelBadge level={p.rating} />
                    </td>
                    <td className="py-2 tabular-nums text-slate-600">{formatLevel(p.level)}</td>
                    <td className="py-2 tabular-nums">
                      {p.matches}
                      <span className="text-xs text-slate-400"> · {p.weeks} hafta</span>
                    </td>
                    <td className="py-2">{p.position ?? '-'}</td>
                    <td className="py-2">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${
                          p.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {p.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="flex justify-end gap-1">
                        <button type="button" onClick={() => setEditingId(p.id)} className="text-xs border rounded px-2 py-1">
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => setActive(p, !p.isActive)}
                          className="text-xs border rounded px-2 py-1"
                        >
                          {p.isActive ? 'Pasife al' : 'Aktif yap'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'single', player: p })}
                          className="text-xs rounded px-2 py-1 border border-red-300 text-red-700"
                        >
                          Sil
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              )}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    Oyuncu bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm?.kind === 'single'}
        title={confirm?.kind === 'single' ? `${confirm.player.name} silinsin mi?` : ''}
        danger
        disabled={busy}
        confirmLabel={busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}
        details={
          confirm?.kind === 'single'
            ? [
                { label: 'Oynadığı maç', value: confirm.player.matches },
                { label: 'Katıldığı hafta', value: confirm.player.weeks },
                { label: 'Haftanın Oyuncusu', value: confirm.player.mvps },
              ]
            : undefined
        }
        warning={
          confirm?.kind === 'single' && confirm.player.matches > 0
            ? 'Bu oyuncu maç oynamış. Silinirse bu maçların kadrosundan çıkar ve diğer oyuncuların seviyeleri yeniden hesaplanır. Sadece listede görünmesin istiyorsan “Pasife al” daha güvenli.'
            : 'Bu işlem geri alınamaz.'
        }
        onConfirm={() => confirm?.kind === 'single' && deleteOne(confirm.player)}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.kind === 'bulk'}
        title={confirm?.kind === 'bulk' ? `${confirm.ids.length} oyuncu silinsin mi?` : ''}
        danger
        disabled={busy}
        confirmLabel={busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}
        warning="Seçilen oyuncuların hiç maç kaydı yok. Bu işlem geri alınamaz."
        onConfirm={() => confirm?.kind === 'bulk' && deleteBulk(confirm.ids)}
        onCancel={() => setConfirm(null)}
      >
        {confirm?.kind === 'bulk' && (
          <p className="text-sm text-slate-700 mb-3">
            {players
              .filter((p) => confirm.ids.includes(p.id))
              .map((p) => p.name)
              .join(', ')}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function AddPlayerForm({ onAdded }: { onAdded: (name: string) => void }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('5');
  const [position, setPosition] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lvl = parseLevel(level);
    if (lvl === null) return setError('Seviye bir sayı olmalı');
    const r = await api('/api/admin/players', 'POST', {
      name,
      level: lvl,
      position: position || undefined,
      heightCm: heightCm ? Number(heightCm) : undefined,
      avatarUrl: avatarUrl || undefined,
      notes: notes || undefined,
    });
    if (!r.ok) return setError(r.data.error ?? 'Oyuncu eklenemedi');
    onAdded(name);
    setName('');
    setLevel('5');
    setPosition('');
    setHeightCm('');
    setAvatarUrl('');
    setNotes('');
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 mb-6 items-end rounded border bg-white p-3">
      <Field label="İsim">
        <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-2 py-1" required />
      </Field>
      <Field label="Başlangıç Seviyesi (0,5-10)">
        <input value={level} onChange={(e) => setLevel(e.target.value)} inputMode="decimal" className="border rounded px-2 py-1 w-24" required />
      </Field>
      <Field label="Pozisyon">
        <PositionSelect value={position} onChange={setPosition} />
      </Field>
      <Field label="Boy (cm)">
        <input type="number" min={100} max={250} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="border rounded px-2 py-1 w-20" />
      </Field>
      <Field label="Profil Fotoğrafı URL">
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="border rounded px-2 py-1" placeholder="https://..." />
      </Field>
      <Field label="Not">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-2 py-1" />
      </Field>
      <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1">
        Ekle
      </button>
      {error && <p className="text-red-600 text-sm w-full">{error}</p>}
    </form>
  );
}

function EditPlayerForm({
  player,
  onCancel,
  onSaved,
}: {
  player: Player;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(player.name);
  const [current, setCurrent] = useState(levelText(player.rating));
  const [base, setBase] = useState(levelText(player.level));
  const [position, setPosition] = useState(player.position ?? '');
  const [heightCm, setHeightCm] = useState(player.heightCm?.toString() ?? '');
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl ?? '');
  const [notes, setNotes] = useState(player.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentChanged = current !== levelText(player.rating);
  const baseChanged = base !== levelText(player.level);

  async function save() {
    setError(null);
    const body: Record<string, unknown> = {
      name,
      position: position || null,
      heightCm: heightCm ? Number(heightCm) : null,
      avatarUrl: avatarUrl || null,
      notes: notes || null,
    };
    if (currentChanged && baseChanged) {
      return setError('Güncel ve başlangıç seviyesinden yalnızca birini değiştir.');
    }
    if (currentChanged) {
      const v = parseLevel(current);
      if (v === null) return setError('Güncel seviye bir sayı olmalı');
      body.currentLevel = v;
    }
    if (baseChanged) {
      const v = parseLevel(base);
      if (v === null) return setError('Başlangıç seviyesi bir sayı olmalı');
      body.level = v;
    }
    setSaving(true);
    const r = await api(`/api/admin/players/${player.id}`, 'PATCH', body);
    setSaving(false);
    if (!r.ok) return setError(r.data.error ?? 'Kaydedilemedi');
    onSaved(`${name} güncellendi`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-end">
        <Field label="İsim">
          <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-2 py-1" />
        </Field>
        <Field label="Güncel seviye">
          <input
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            inputMode="decimal"
            disabled={baseChanged}
            className="border rounded px-2 py-1 w-24 disabled:bg-slate-100"
          />
        </Field>
        <Field label="Başlangıç seviyesi">
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            inputMode="decimal"
            disabled={currentChanged}
            className="border rounded px-2 py-1 w-24 disabled:bg-slate-100"
          />
        </Field>
        <Field label="Pozisyon">
          <PositionSelect value={position} onChange={setPosition} />
        </Field>
        <Field label="Boy (cm)">
          <input type="number" min={100} max={250} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="border rounded px-2 py-1 w-20" />
        </Field>
        <Field label="Profil Fotoğrafı URL">
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="border rounded px-2 py-1 w-56" placeholder="https://..." />
        </Field>
        <Field label="Not">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-2 py-1 w-48" />
        </Field>
      </div>
      <p className="text-xs text-slate-500">
        <strong>Güncel seviye</strong>: oyuncunun şu anki seviyesini doğrudan ayarlar (sistem başlangıç seviyesini buna göre
        hesaplar). <strong>Başlangıç seviyesi</strong>: ilk maçtan önceki seviye; değiştirilirse tüm geçmiş yeniden hesaplanır.
        Ondalık kullanabilirsin (örn. 5,5).
      </p>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className="bg-emerald-700 text-white rounded px-3 py-1 text-sm disabled:opacity-50">
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={onCancel} className="border rounded px-3 py-1 text-sm">
          Vazgeç
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-600 mb-0.5">{label}</label>
      {children}
    </div>
  );
}

function PositionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="border rounded px-2 py-1">
      <option value="">Seçilmedi</option>
      {PLAYER_POSITIONS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
