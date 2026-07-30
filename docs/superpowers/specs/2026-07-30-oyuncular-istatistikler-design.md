# Oyuncular ve İstatistikler Sayfaları — Tasarım

Tarih: 2026-07-30

## 1. Amaç ve Kapsam

Mevcut voleybol uygulamasına, mevcut mimariyi bozmadan üç yeni public sayfa (`/players`, `/players/:id`, `/statistics`), buna karşılık gelen public API endpointleri ve admin oyuncu yönetiminin genişletilmesi eklenir. Tüm istatistikler mevcut `Week`/`Team`/`TeamPlayer`/`Match`/`WeeklyMvp` kayıtlarından dinamik olarak hesaplanır; kalıcı türetilmiş veri tabloları oluşturulmaz.

Aşağıdaki kararlar önceki turda onaylandı:
- **Sezon kavramı eklenmeyecek.** İstatistikler sayfası kapsam filtresi olarak sadece "Tüm Zamanlar / Son 10 Hafta / Belirli Bir Hafta" sunar.
- **Kalıcı takım kimliği/istatistiği eklenmeyecek.** Takım karşılaştırmaları sadece maç bazlı rekorlarla sınırlıdır (en farklı/en yakın/en yüksek skorlu maç).
- **`position` sabit seçenek listesinden yönetilir**, serbest metin değildir.
- **`/players/:id` mevcut `player.id` (cuid) kullanır**, yeni bir `slug` alanı eklenmez.

Bu turda eklenen 12 düzeltme aşağıdaki bölümlere işlendi.

## 2. Veritabanı Değişiklikleri

Tek migration, mevcut `Player` tablosuna kolon ekler; yeni tablo yoktur.

```prisma
model Player {
  id              String         @id @default(cuid())
  name            String
  level           Int
  position        String?
  heightCm        Int?
  avatarUrl       String?
  notes           String?
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  teamPlayers     TeamPlayer[]
  weekAttendances WeekAttendee[]
  mvps            WeeklyMvp[]
}

model WeekAttendee {
  // ...mevcut alanlar
  @@index([playerId])
}

model TeamPlayer {
  // ...mevcut alanlar
  @@index([playerId])
}

model WeeklyMvp {
  // ...mevcut alanlar
  @@index([playerId])
}

model Match {
  // ...mevcut alanlar
  @@index([weekId])
  @@index([teamAId])
  @@index([teamBId])
}
```

Notlar:
- Mevcut `level` alanı "seviye/skill level" olarak zaten var; ayrı bir `skillLevel` kolonu **eklenmez** — aynı veri iki kolonda tutulmaz.
- **`updatedAt` güvenlik notu (madde 12):** `@updatedAt` alanı Prisma tarafından `DEFAULT CURRENT_TIMESTAMP` ile birlikte üretilir, bu nedenle mevcut satırlar için `NOT NULL` ihlali oluşmaz. Migration'ı oluşturduktan sonra `prisma/migrations/<timestamp>_.../migration.sql` içinde şu satırın bulunduğu **elle doğrulanacak**:
  ```sql
  ALTER TABLE "Player" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  ```
  Eğer Prisma bu alanı `DEFAULT` olmadan üretirse (beklenmez ama kontrol edilecek), migration elle düzeltilip mevcut kayıtlar için `now()` backfill'i eklenecek.
- `@@index` eklemeleri sadece index oluşturur, veri taşıma gerektirmez — güvenli, geriye dönük uyumlu.

## 3. Merkezi Sabitler ve Doğrulama (madde 4)

`src/lib/constants.ts` (yeni dosya):

```ts
export const PLAYER_POSITIONS = ['Pasör', 'Çaprazcı', 'Smaçör', 'Orta Oyuncu', 'Libero'] as const;
export type PlayerPosition = typeof PLAYER_POSITIONS[number];

export function isValidPlayerPosition(value: unknown): value is PlayerPosition {
  return typeof value === 'string' && (PLAYER_POSITIONS as readonly string[]).includes(value);
}
```

Kullanım noktaları:
- **Admin API** (`/api/admin/players`, `/api/admin/players/[id]`): `position` gönderilirse `isValidPlayerPosition` ile doğrulanır; geçersizse `400` + `{ error: 'Geçersiz pozisyon' }`.
- **Admin form**: `<select>` seçenekleri `PLAYER_POSITIONS`'tan üretilir, serbest metin girişi yoktur.
- **Public API** (`/api/players`): `position` query param'ı gönderilirse aynı fonksiyonla doğrulanır; geçersiz değer `400` döner (sessizce yok sayılmaz).
- **Public filtre dropdown'u**: aynı sabitten üretilir.

## 4. Maç Tamamlanma Kontrolü — `isCompletedMatch` (madde 1)

Mevcut kodda `sets.length >= 2` kontrolü `weekView.ts` içinde doğrudan yazılı. Bu, `src/lib/matchScoring.ts` içine eklenecek merkezi bir fonksiyona taşınır ve **hem yeni hem mevcut kod bu fonksiyonu kullanacak şekilde güncellenir** (davranışı değiştirmeyen, hedefe yönelik bir refactor):

```ts
// src/lib/matchScoring.ts içine eklenir
export interface MatchLike {
  sets: SetScore[];
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'; // Match.status henüz DB'de yok — ileride eklenirse buraya bağlanır
}

export function isCompletedMatch(match: MatchLike): boolean {
  if (match.status) {
    return match.status === 'COMPLETED';
  }
  if (match.sets.length < 2) return false;
  try {
    computeMatchResult(match.sets);
    return true;
  } catch {
    return false;
  }
}
```

- `weekView.ts` içindeki `sets.length >= 2` filtresi bu fonksiyonla değiştirilir (davranış aynı kalır, çünkü `status` alanı henüz yok).
- Yeni `playerService.ts`/`statisticsService.ts` içindeki tüm "oynanmış maç" filtrelemeleri bu fonksiyonu kullanır.
- İleride `Match.status` eklenirse, tek bir yerde (`isCompletedMatch`) değişiklik yeterli olur.

## 5. Veri Bütünlüğü — Aynı Maçta İki Takımda Aynı Oyuncu (madde 2)

`TeamPlayer` tablosunda `(teamId, playerId)` unique kısıtı var ama bir oyuncunun **aynı haftada farklı takımlarda** bulunmasını engellemiyor — bu geçerli bir senaryo (desteklenir). Ancak eğer bir oyuncu, **aynı maçın karşılıklı iki takımının** kadrosundaysa (teamA ve teamB'nin ikisinde de), bu bir veri tutarsızlığıdır ve galibiyet/mağlubiyet ataması anlamsızlaşır.

Kural:
- Oyuncu bazlı maç kayıtları oluşturulurken, her `(playerId, matchId)` çifti için oyuncunun o maçta **yalnızca bir** takımda (teamA veya teamB) olduğu kontrol edilir.
- Çelişki bulunursa: o maç **o oyuncunun istatistiklerine dahil edilmez** (sessizce dedupe edilip gizlenmez) ve sonuç nesnesine `integrityWarnings: string[]` alanına açıklayıcı bir mesaj eklenir (örn. `"${matchId}: oyuncu maçın her iki takımında da kayıtlı, istatistiklere dahil edilmedi"`).
- Bu uyarılar `/api/players/:id` response'unda `integrityWarnings` alanı olarak döner (boşsa `[]`); admin bunu görüp veri düzeltebilir. Public oyuncu listesinde gösterilmez (gürültü yaratmamak için), sadece detay endpoint'inde.
- Aynı oyuncunun **farklı maçlarda** (aynı hafta içinde dahi) farklı takımlarda olması **normal** kabul edilir ve her maç ayrı ayrı sayılır — sadece aynı `matchId` için çakışma engellenir.

## 6. Hesaplama Katmanı Mimarisi — Saf Fonksiyonlar vs Servis (madde 9)

Mevcut `standings.ts` (saf) + `weekView.ts` (Prisma + orkestrasyon) ayrımı birebir korunur:

- **`src/lib/playerStats.ts`** (yeni, saf fonksiyonlar, Prisma import etmez): `computePlayerStats()`, streak hesaplama, dedupe/çakışma tespiti, last-10 hesaplama. Girdi olarak düz TS nesneleri alır, DB'yi bilmez. Colocated `playerStats.test.ts`.
- **`src/lib/playerService.ts`** (yeni, Prisma sorguları + orkestrasyon): `getPlayerDetails(playerId)`, `listPlayers(filters)` gibi fonksiyonlar. Prisma'dan veri çeker, `playerStats.ts`'teki saf fonksiyonlara besler, sonucu public response şekline dönüştürür (bkz. madde 7).
- **`src/lib/statisticsService.ts`** (yeni, Prisma + orkestrasyon): genel istatistik kartları, lider tabloları, maç rekorları. Kapsam filtrelemesi (madde 7 — `scope=last10`) burada yapılır, hesaplama `playerStats.ts`/yeni `matchRecords.ts` saf fonksiyonlarına devredilir.

Bu, N+1 sorgu riskini de azaltır: her servis fonksiyonu ilgili veriyi `include` ile tek sorguda çeker (mevcut `getWeekView` deseniyle aynı).

## 7. Metrik Tanımları ve İsimlendirme (madde 6, 7, 10)

Bir metrik ismi tek bir anlama gelir, karışıklık önlenir:

| Alan | Tanım |
|---|---|
| `weeksPlayed` | Oyuncunun **en az bir tamamlanmış maçta** (bkz. `isCompletedMatch`) bir takım kadrosunda bulunduğu **benzersiz** hafta sayısı. Ana "toplam katıldığı hafta" metriği budur (oyuncu kartı/listesinde gösterilen). |
| `weeksRegistered` | `WeekAttendee` kayıtlarından hesaplanan, oyuncunun **kadroya dahil edildiği** hafta sayısı (maç oynanıp oynanmadığından bağımsız). Sadece detay sayfasında ayrı, küçük bir bilgi olarak gösterilir — ana metrik değildir. |
| `firstAttendedDate` / `lastAttendedDate` | `WeekAttendee` → `Week.date` min/max (yani `weeksRegistered` kaynağından — "ilk/son katıldığı tarih" sorusuna en doğal karşılık, maç oynanmasa bile hafta kadrosuna girme anını yansıtır). |
| `matchesPlayed`, `wins`, `losses`, `winRate` | Sadece `isCompletedMatch` olan, çakışma taşımayan maçlardan hesaplanır. |
| `currentWinStreak` | En son oynanan maçtan geriye doğru, kesintisiz galibiyet sayısı. İlk maç mağlubiyetse `0`. |
| `longestWinStreak` | Oyuncunun tüm maç geçmişindeki (kapsam filtresine göre sınırlanmış) en uzun kesintisiz galibiyet serisi. |
| `mvpCount` | `WeeklyMvp` satır sayısı. |

**Deterministik sıralama (madde 7):** Oyuncunun maç geçmişi, streak ve "son 10 maç" hesaplamaları için şu sıraya göre dizilir: `weekDate ASC, match.createdAt ASC, match.id ASC` (son alan salt determinizm için tie-breaker). "Son 10 maç" ve "current streak", bu sıranın **sonundan başa doğru** okunmasıyla hesaplanır.

**Win rate minimum maç şartı (madde 10):** `/api/players?sortBy=winRate` çağrıldığında varsayılan `minMatches=3` uygulanır (query param ile override edilebilir). Bu eşik:
- Response'a `minMatchesForWinRate: number` alanı olarak eklenir.
- Frontend'de "En Yüksek Kazanma Oranı" sıralama seçeneğinin yanında `(en az {minMatchesForWinRate} maç oynamış oyuncular arasında)` açıklaması gösterilir.
- Eşik yalnızca `sortBy=winRate` iken filtre olarak uygulanır; diğer sıralamalarda (isim, maç sayısı vb.) tüm oyuncular listelenir.

## 8. Kapsam Filtresi — `scope=last10` Tanımı (madde 5)

`scope=last10`: **en az bir tamamlanmış maçı olan** en yeni 10 hafta. Boş haftalar (hiç maçı olmayan/hiç maçı tamamlanmamış) ve gelecek tarihli/henüz oynanmamış haftalar bu sayıma dahil edilmez.

```ts
// statisticsService.ts içinde
async function getLastNPlayedWeeks(n: number): Promise<WeekWithMatches[]> {
  const weeks = await prisma.week.findMany({
    orderBy: { date: 'desc' },
    include: { matches: true },
  });
  return weeks
    .filter((w) => w.matches.some((m) => isCompletedMatch({ sets: m.sets as SetScore[] })))
    .slice(0, n);
}
```

Mevcut veri hacmi (haftalık kadans) düşünüldüğünde tüm haftaları çekip bellekte filtrelemek performans sorunu yaratmaz; ileride hafta sayısı çok büyürse bu sorgu SQL tarafında `EXISTS` alt sorgusuyla optimize edilebilir (şimdilik gereksiz erken optimizasyon, eklenmiyor).

`scope` parametresi (`all|last10|week`) üç `/api/statistics/*` endpoint'inin (`overview`, `players`, `teams`) tümüne aynı şekilde uygulanır: hesaplama, kapsam dışındaki haftaların maçlarını dahil etmeden, yalnızca kapsam içi hafta kümesi üzerinden yapılır. `/api/players` (genel oyuncu listesi) kapsam filtresine tabi **değildir** — her zaman tüm zamanların verisini gösterir; kapsamlı görünüm yalnızca `/statistics` sayfasının sorumluluğundadır.

## 9. Notes Alanının Gizliliği (madde 3)

`Player.notes` **sadece admin API/arayüzünde** görünür. Public tarafta hiçbir yerde dönmez:

- `src/lib/playerService.ts` içindeki tüm Prisma `select`'ler `notes` alanını **içermez** (whitelist yaklaşımı — sadece ihtiyaç duyulan alanlar seçilir, `notes` listede yoktur).
- `/api/players` ve `/api/players/:id` response tipleri (`PlayerPublic`, `PlayerDetail`) TypeScript seviyesinde `notes` alanı içermeyen ayrı interface'lerdir — admin'in kullandığı `Player` (Prisma) tipiyle karıştırılmaz.
- `/api/admin/players*` (mevcut endpointler) `notes`'u normal şekilde döner/kabul eder — değişiklik yok.

## 10. `getPlayerDetails` — Tek Servis, İki Tüketici (madde 8)

```ts
// src/lib/playerService.ts
export async function getPlayerDetails(playerId: string): Promise<PlayerDetail | null> { ... }
```

- **`src/app/api/players/[id]/route.ts`**: `getPlayerDetails(params.id)` çağırır, `null` ise `404`, aksi halde JSON döner.
- **`src/app/players/[id]/page.tsx`**: Server Component, aynı `getPlayerDetails(id)` fonksiyonunu doğrudan çağırır (mevcut `hafta/[weekId]/page.tsx` + `getWeekView` deseniyle birebir aynı), `null` ise `notFound()`.

Hesaplama mantığı tek yerde yaşar; API route sadece ince bir HTTP sarmalayıcıdır.

## 11. API Tasarımı

Tüm public endpointler `/api/admin` altında **değildir**, middleware'den etkilenmez, auth gerekmez.

### `GET /api/players`
Query: `search, position, skillLevel, sortBy (name|matches|wins|winRate|mvps), order (asc|desc), minMatches, limit, offset`
Response:
```json
{
  "players": [ { "id", "name", "position", "level", "avatarUrl", "isActive", "weeksPlayed", "matchesPlayed", "wins", "losses", "winRate", "mvpCount" } ],
  "total": 42,
  "limit": 20,
  "offset": 0,
  "minMatchesForWinRate": 3
}
```
(`notes` yok — madde 3.)

### `GET /api/players/:id`
`getPlayerDetails` çıktısı: profil (notes hariç) + `matchesPlayed/wins/losses/winRate/setsWon/setsLost/setDiff` + `weeksPlayed` + `weeksRegistered` + `firstAttendedDate/lastAttendedDate` + `currentWinStreak/longestWinStreak` + `last10` + `mvpCount` + `mvpWeeks` + `recentMatches` + `teamsPlayedFor` + `integrityWarnings`.

### `GET /api/statistics/overview?scope=all|last10|week&weekId=`
Toplam oyuncu/hafta/maç/set, ortalama haftalık katılımcı, en yüksek katılımlı hafta.

### `GET /api/statistics/players?scope=...`
Tüm lider tabloları (top 10 + toplam sayı) tek response'ta; her winRate listesinde `minMatchesForWinRate` alanı bulunur. "Tümünü Gör" → `/players?sortBy=...` sayfasına yönlendirir (ayrı bir "tüm liste" endpoint'i yoktur, `/api/players` yeniden kullanılır).

### `GET /api/statistics/teams?scope=...`
Sadece maç bazlı rekorlar: en farklı biten maç, en yakın biten maç, en yüksek toplam sayılı maç. Kalıcı takım kimliği olmadığından takım liderlik tablosu yoktur.

## 12. Avatar Görseli (madde 11)

- **Admin tarafında doğrulama:** `avatarUrl` gönderildiğinde `new URL(value)` ile parse edilir; `protocol` `http:`/`https:` değilse `400` + `{ error: 'Geçersiz görsel URL\'si' }`.
- **Render:** `next/image` **kullanılmaz** — `avatarUrl` admin tarafından girilen keyfi harici bir domain olduğundan, `next/image` her domain için `next.config.js`'te `images.remotePatterns` beyazlistesi ister; bu pratik değil ve güvenlik açısından geniş bir wildcard gerektirir. Bunun yerine düz `<img>` etiketi kullanılır.
- **Bozuk görsel fallback'i:** Yeni `src/components/PlayerAvatar.tsx` (`'use client'`, mevcut `LogoutButton.tsx` gibi küçük client-island deseniyle): `avatarUrl` varsa `<img onError={...}>` render eder; hata olursa veya `avatarUrl` yoksa isim baş harflerinden oluşan bir daire (`bg-slate-200 text-slate-700 rounded-full`) gösterir. Server Component sayfalarda (`/players`, `/players/:id`) bu küçük client component gömülü olarak kullanılır.

## 13. Sayfalar ve Navigasyon

- **`/players`**: `'use client'`, arama/filtre/sıralama/pagination için `GET /api/players` çağırır. Masaüstünde tablo, mobilde kart görünümü (mevcut Tailwind breakpoint'leriyle, `hidden md:table` / `md:hidden` deseni).
- **`/players/:id`**: Server Component, `getPlayerDetails` doğrudan çağrılır.
- **`/statistics`**: `'use client'`, kapsam filtresi state'i değiştikçe 3 endpoint'i yeniden çağırır.
- **`src/components/PublicNav.tsx`** (`'use client'`, mobil hamburger): Ana Sayfa / Oyuncular / İstatistikler / Geçmiş Haftalar. Her public sayfaya (`page.tsx`, `arsiv/page.tsx`, `hafta/[weekId]/page.tsx` dahil, mevcut ad-hoc header satırlarının yerine) eklenir. Route group'a taşıma yapılmaz (mevcut düz dosya yapısı korunur).
- Loading/error/empty state: mevcut minimal konvansiyon korunur (metin tabanlı, `text-red-600 text-sm` hata, `text-slate-600` boş durum) + basit bir iskelet (`animate-pulse` bloklar) yeni liste/istatistik sayfalarına eklenir çünkü bunlar client-side fetch yapıyor ve ilk yüklemede boş görünmemeli.

## 14. Admin Değişiklikleri

- `/admin/oyuncular` formu genişler: `position` (select, `PLAYER_POSITIONS`), `heightCm` (number, opsiyonel), `avatarUrl` (text, URL validasyonlu), `notes` (textarea).
- `/api/admin/players` (POST) ve `/api/admin/players/[id]` (PATCH) yeni alanları kabul eder, `position`/`avatarUrl` sunucu tarafında doğrulanır.
- Silme yok — mevcut `isActive` toggle soft-delete görevini zaten görüyor; yeni bir delete endpoint'i eklenmez.

## 15. Test Planı

`playerStats.test.ts` (saf fonksiyonlar) aşağıdaki senaryoları kapsar:
- Hiç maç oynamamış oyuncu → `matchesPlayed=0, winRate=0` (sıfıra bölme güvenli)
- Bir maç oynayan oyuncu
- Birden fazla hafta oynayan oyuncu
- Aynı hafta farklı maçlarda farklı takımlarda oynayan oyuncu (desteklenir, çift sayılmaz)
- **Aynı maçın iki takımında aynı oyuncu** → o maç hariç tutulur + `integrityWarnings` dolu döner
- Skoru girilmemiş / eksik set'li maç (`isCompletedMatch=false`) → istatistiklere dahil edilmez
- Pasif oyuncu → normal hesaplanır (aktiflik sadece listeleme filtresi, geçmiş veri etkilenmez)
- `weeksPlayed` vs `weeksRegistered` farkının doğru ayrışması (bir haftaya kadroya girip maçı hiç oynanmamışsa `weeksRegistered` sayar, `weeksPlayed` saymaz)
- `currentWinStreak`/`longestWinStreak` doğru sırayla hesaplanması (deterministik tie-break dahil)
- Aynı isimli iki farklı oyuncu (id bazlı ayrışma, isim çakışması sorun yaratmaz)
- `scope=last10` → boş/gelecek haftaların dışlanması

Ayrıca `statisticsService`/`playerService` için entegrasyon düzeyinde manuel doğrulama: dev server üzerinde `/players`, `/players/:id`, `/statistics` sayfaları ve mobil görünüm; yetkisiz `/api/admin/players` erişiminin `401` dönmesi (mevcut middleware zaten kapsıyor, regresyon kontrolü olarak doğrulanacak).

## 16. Teslimat Notları (implementasyon sonrası paylaşılacak)

- Değiştirilen/eklenen dosyalar
- `npx prisma migrate dev --name add_player_profile_fields_and_indexes` komutu
- Yeni environment variable **yok** (mevcut `AUTH_SECRET`/`ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`/`DATABASE_URL` yeterli)
- Test komutu: `npm run test`
