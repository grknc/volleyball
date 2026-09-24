import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPlayerDetails } from '@/lib/playerService';
import { getRatingSnapshot } from '@/lib/ratingService';
import { buildPlayerRatingProfile, type Companion } from '@/lib/playerProfile';
import { formatLevel, POINTS, RELIABILITY_FULL_AT } from '@/lib/rating';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PublicNav } from '@/components/PublicNav';
import { LevelBadge } from '@/components/LevelBadge';
import { LevelHistory } from '@/components/LevelHistory';
import { ProfileMatchCard } from '@/components/ProfileMatchCard';
import { BadgeGrid } from '@/components/Badges';
import { badgesForPlayer } from '@/lib/badges';

export const dynamic = 'force-dynamic';

const MATCHES_SHOWN = 20;

export default async function PlayerDetailPage({ params }: { params: { id: string } }) {
  const [player, snapshot] = await Promise.all([getPlayerDetails(params.id), getRatingSnapshot()]);
  if (!player) notFound();
  const profile = buildPlayerRatingProfile(snapshot, player.id);
  if (!profile) notFound();

  const reliabilityPct = Math.round(profile.reliability * 100);
  const badges = badgesForPlayer(snapshot, player.id);
  const earnedBadges = badges.filter((b) => b.earned);

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6">
      <PublicNav />
      <Link href="/players" className="text-sm text-slate-600 hover:text-slate-900">
        ← Oyuncular
      </Link>

      {/* Başlık */}
      <section className="flex items-center gap-4 mt-3 mb-4">
        <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} sizeClassName="w-20 h-20 text-xl" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold truncate">{player.name}</h1>
          <p className="text-slate-600 text-sm">
            {player.position ?? 'Pozisyon belirtilmemiş'}
            {player.heightCm ? ` · ${player.heightCm} cm` : ''}
            {!player.isActive && ' · Pasif'}
          </p>
          <div className="flex gap-6 mt-2">
            <HeaderStat value={profile.matches} label="Maç" />
            <HeaderStat value={profile.points} label="Puan" />
            <HeaderStat value={profile.rank ? `#${profile.rank}` : '-'} label={`Sıra / ${profile.rankedTotal}`} />
            <HeaderStat value={earnedBadges.length} label="Rozet" />
          </div>
        </div>
      </section>

      {process.env.NODE_ENV !== 'production' && player.integrityWarnings.length > 0 && (
        <p className="text-amber-700 text-sm mb-4">{player.integrityWarnings.join(' ')}</p>
      )}

      {/* Seviye kartı */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white p-5 mb-6">
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full border-[14px] border-white/5" aria-hidden />
        <div className="absolute right-10 bottom-[-40px] w-28 h-28 rounded-full border-[10px] border-lime-300/10" aria-hidden />
        <p className="text-xs uppercase tracking-widest text-slate-300">Voleybol Seviyesi</p>
        <p className="text-5xl font-black text-lime-300 tabular-nums mt-1">{formatLevel(profile.rating)}</p>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span>Seviye güvenilirliği: %{reliabilityPct}</span>
          <span
            className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
              profile.reliabilityLabel === 'YÜKSEK'
                ? 'bg-emerald-400 text-emerald-950'
                : profile.reliabilityLabel === 'ORTA'
                  ? 'bg-amber-300 text-amber-950'
                  : 'bg-blue-400 text-blue-950'
            }`}
          >
            {profile.reliabilityLabel}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-lime-300" style={{ width: `${reliabilityPct}%` }} />
        </div>
        <p className="mt-3 text-xs text-slate-300">
          Başlangıç {formatLevel(profile.baseLevel)} · Zirve {formatLevel(profile.peakRating)}
        </p>
      </section>

      {/* Seviye gelişimi */}
      <Card title="Seviye Gelişimi">
        <LevelHistory history={profile.levelHistory} baseLevel={profile.baseLevel} />
      </Card>

      {/* İstatistikler */}
      <Card title="İstatistikler">
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 flex-1">
            <BigStat value={profile.matches} label="Toplam" />
            <BigStat value={profile.wins} label="Galibiyet" tone="green" />
            <BigStat value={profile.last6Count} label="Son maçlar" />
            <BigStat value={profile.last6Wins} label="Kazanılan" tone="green" />
          </div>
          <EfficiencyRing value={profile.efficiencyLast6} caption={`Son ${profile.last6Count || 6}`} />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
          <MiniStat label="Kazanma %" value={`%${player.winRate.toFixed(0)}`} />
          <MiniStat label="Set (K/V)" value={`${player.setsWon}/${player.setsLost}`} />
          <MiniStat label="Set Averajı" value={player.setDiff > 0 ? `+${player.setDiff}` : player.setDiff} />
          <MiniStat label="Güncel Seri" value={player.currentWinStreak} />
          <MiniStat label="En Uzun Seri" value={player.longestWinStreak} />
          <MiniStat label="Haftanın Oyuncusu" value={player.mvpCount} />
          <MiniStat label="Oynadığı Hafta" value={player.weeksPlayed} />
          <MiniStat label="Kadroda Olduğu Hafta" value={player.weeksRegistered} />
        </div>
        {player.last10.length > 0 && (
          <div className="flex gap-1 mt-4" aria-label="Son 10 maç">
            {player.last10.map((r, i) => (
              <span
                key={i}
                className={`flex-1 h-2 rounded-full ${r === 'W' ? 'bg-emerald-500' : 'bg-rose-400'}`}
                title={r === 'W' ? 'Galibiyet' : 'Mağlubiyet'}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Rozetler */}
      <Card title="Rozetler">
        <BadgeGrid badges={badges} />
      </Card>

      {/* Formatlar */}
      {profile.formats.length > 0 && (
        <Card title="Oynadığı Formatlar">
          <div className="flex flex-wrap gap-2">
            {profile.formats.map((f) => (
              <div key={f.format} className="rounded-xl border border-slate-200 px-3 py-2 min-w-[92px]">
                <p className="text-lg font-extrabold text-blue-700">{f.format}</p>
                <p className="text-xs text-slate-600">
                  {f.matches} maç · %{Math.round((f.wins / f.matches) * 100)} galibiyet
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <CompanionSection title="En Çok Birlikte Oynadığı Oyuncular" people={profile.partners} verb="birlikte" />
      <CompanionSection title="En Çok Karşılaştığı Rakipler" people={profile.opponents} verb="karşı karşıya" />

      {/* Maçlar */}
      <section className="mb-6">
        <h2 className="text-lg font-bold mb-3">Maçlar</h2>
        {profile.cards.length === 0 ? (
          <p className="text-slate-500 text-sm">Henüz oynanmış maç yok.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {profile.cards.slice(0, MATCHES_SHOWN).map((c) => (
              <ProfileMatchCard key={c.matchId} card={c} playerId={player.id} />
            ))}
            {profile.cards.length > MATCHES_SHOWN && (
              <p className="text-xs text-slate-500 text-center">
                Son {MATCHES_SHOWN} maç gösteriliyor (toplam {profile.cards.length}).
              </p>
            )}
          </div>
        )}
      </section>

      {/* Oyuncu bilgileri */}
      <Card title="Oyuncu Bilgileri">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Pozisyon" value={player.position ?? '-'} />
          <Info label="Boy" value={player.heightCm ? `${player.heightCm} cm` : '-'} />
          <Info
            label="İlk katılım"
            value={player.firstAttendedDate ? new Date(player.firstAttendedDate).toLocaleDateString('tr-TR') : '-'}
          />
          <Info
            label="Son katılım"
            value={player.lastAttendedDate ? new Date(player.lastAttendedDate).toLocaleDateString('tr-TR') : '-'}
          />
        </dl>
        {player.mvpWeeks.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-slate-500 mb-1">⭐ Haftanın Oyuncusu seçildiği haftalar</p>
            <div className="flex flex-wrap gap-1.5">
              {player.mvpWeeks.map((w) => (
                <Link
                  key={w.weekId}
                  href={`/hafta/${w.weekId}`}
                  className="text-xs rounded-full bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5"
                >
                  {new Date(w.weekDate).toLocaleDateString('tr-TR')}
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <summary className="font-semibold cursor-pointer">Seviye ve puan nasıl hesaplanıyor?</summary>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Herkes admin tarafından verilen başlangıç seviyesiyle (1-10) başlar.</li>
          <li>
            Her maçtan önce iki takımın ortalama seviyesine göre bir kazanma beklentisi hesaplanır. Beklenenden iyi sonuç
            seviyeyi yükseltir, kötü sonuç düşürür. Güçlü rakibi yenmek daha çok kazandırır.
          </li>
          <li>2-0 ve farklı galibiyetler seviyeyi biraz daha fazla etkiler; 2-1 maçlarda değişim daha küçüktür.</li>
          <li>
            Yeni oyuncuların seviyesi hızlı değişir; {RELIABILITY_FULL_AT} maça ulaştıkça güvenilirlik %100 olur ve değişim
            sakinleşir. 2x2 formatında bireysel etki 6x6 formatından büyüktür.
          </li>
          <li>
            Puan: maç başına +{POINTS.played}, galibiyet +{POINTS.win}, 2-0 +{POINTS.sweepBonus}, sürpriz galibiyet +
            {POINTS.upsetBonus}, Haftanın Oyuncusu +{POINTS.mvp}.
          </li>
        </ul>
      </details>
    </main>
  );
}

function HeaderStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="text-lg font-extrabold leading-none tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-6">
      <h2 className="text-lg font-bold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function BigStat({ value, label, tone }: { value: number; label: string; tone?: 'green' }) {
  return (
    <div>
      <p className={`text-3xl font-extrabold tabular-nums ${tone === 'green' ? 'text-emerald-600' : ''}`}>{value}</p>
      <p className={`text-xs ${tone === 'green' ? 'text-emerald-700' : 'text-slate-600'}`}>{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
      <p className="font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EfficiencyRing({ value, caption }: { value: number; caption: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#0f172a"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold">%{Math.round(value)}</span>
        <span className="text-[10px] text-slate-500 leading-tight">
          Efektivite
          <br />
          {caption}
        </span>
      </div>
    </div>
  );
}

function CompanionSection({ title, people, verb }: { title: string; people: Companion[]; verb: string }) {
  if (people.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold mb-3">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {people.map((p) => (
          <Link
            key={p.playerId}
            href={`/players/${p.playerId}`}
            className="snap-start shrink-0 w-36 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
          >
            <div className="h-20 bg-gradient-to-br from-blue-100 to-lime-100 flex items-center justify-center">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} sizeClassName="w-14 h-14" />
            </div>
            <div className="p-2.5">
              <p className="font-bold text-sm truncate">{p.name}</p>
              <p className="text-xs text-slate-600 flex items-center gap-1">
                Seviye <LevelBadge level={p.level} size="xs" />
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {p.matches} maç {verb} · {p.wins}G
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
