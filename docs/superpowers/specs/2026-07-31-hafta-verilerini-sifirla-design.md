# Hafta Verilerini Sıfırla — Tasarım

Tarih: 2026-07-31

## Amaç

Admin panelinde, yanlış veya test amacıyla girilmiş bir haftanın organizasyon
verilerini (takımlar, maçlar, set skorları, MVP, isteğe bağlı katılımcılar)
temizleyip haftayı tekrar gerçek organizasyon için kullanılabilir hale
getiren bir "Hafta Verilerini Sıfırla" işlemi eklemek. `Week` kaydı ve
`Player` kayıtları hiçbir koşulda silinmez.

## Kapsam dışı

- Başka haftalara ait veriler
- Oyuncu profil bilgileri (`Player` tablosu)
- Haftanın tamamen silinmesi (mevcut `DELETE /api/admin/weeks/:id` zaten var)

## Veri modeli ve cascade analizi

`prisma/schema.prisma`'daki ilişkiler (tümü `onDelete: Cascade`, DB seviyesinde
`ON DELETE CASCADE` olarak doğrulandı — `prisma/migrations/20260729105254_init/migration.sql:79-106`):

| Tablo | FK → | Reset'te silinir mi |
|---|---|---|
| `WeeklyMvp` | `weekId` → Week | Her zaman |
| `TeamPlayer` | `teamId` → Team | Her zaman |
| `Match` | `weekId` → Week, `teamAId`/`teamBId` → Team | Her zaman |
| `Team` | `weekId` → Week | Her zaman |
| `WeekAttendee` | `weekId` → Week | Sadece `removeAttendees: true` |
| `Week` | — | Asla |
| `Player` | — | Asla |

"Set skorları" ayrı tablo değil, `Match.sets` (Json) kolonu — Match silinince
otomatik gider.

DB-level cascade zaten `Team` silinince `TeamPlayer`/`Match`'i de silerdi,
ama kodda buna örtük olarak güvenilmeyecek: her tablo, bağımlılık sırasına
göre açıkça ve `weekId`/`teamId in [...]` filtresiyle silinecek. Bu hem
okunabilirlik hem de "başka haftaya sızma" riskini sıfırlama açısından
tercih edildi.

## Hafta durumu

Reset işlemi varsayılan olarak haftayı tekrar kullanılabilir hale getirmek
için `Week.status` değerini `'draft'` yapabilir. Bu davranış `resetStatus`
bayrağıyla kontrol edilir:

- API'de `resetStatus` gönderilmezse **varsayılan `false`** (güvenli varsayılan,
  `removeAttendees` ile tutarlı — API açık niyet ister).
- Admin UI'daki checkbox ("Haftayı Taslak durumuna al") **varsayılan işaretli**
  gelir, yani normal kullanım akışında client her zaman `resetStatus: true`
  gönderir. Bu, kullanıcının "bu haftayı tekrar gerçek organizasyon için
  kullanacağım" ihtiyacını varsayılan davranış yapar, API sözleşmesini
  değiştirmeden.
- `resetStatus: true` ise transaction içinde `Week.status = 'draft'` güncellenir.
- `resetStatus: false` ise mevcut status korunur.

## Endpoint tasarımı

```
POST /api/admin/weeks/:id/reset
```

Auth: `src/middleware.ts` zaten `/api/admin/:path*` üzerinde oturum kontrolü
yapıyor (`{ error: 'Yetkisiz erişim' }`, 401) — route içinde ekstra kontrol
gerekmiyor.

Request body:
```json
{ "removeAttendees": false, "resetStatus": true }
```
İki alan da opsiyonel, ikisi de olmadığında `removeAttendees=false`,
`resetStatus=false` varsayılır.

Response (200):
```json
{
  "success": true,
  "weekId": "...",
  "status": "draft",
  "deleted": {
    "teams": 2,
    "matches": 1,
    "sets": 2,
    "mvps": 1,
    "attendees": 0
  }
}
```

Hata durumları:
- Hafta yoksa: `404 { "error": "Hafta bulunamadı" }`
- Yetkisiz: middleware tarafından `401 { "error": "Yetkisiz erişim" }`
- Beklenmeyen hata: `500 { "error": "Hafta verileri sıfırlanamadı" }` —
  ham Prisma/DB hatası asla client'a sızmaz, sadece `console.error` ile loglanır
  (mevcut `DELETE /api/admin/weeks/:id` deseniyle birebir aynı).

`route.ts` mevcut class-based hata deseni izlenerek yazılır
(`WeekNotFoundError extends Error`, `[id]/route.ts:49-77` şablonu).

## Transaction ve doğrulama

Transaction dışında ön kontrol **yapılmaz** (gereksiz round-trip). Tüm
doğrulama, sayım ve silme işlemi tek `prisma.$transaction` içinde gerçekleşir:

```ts
await prisma.$transaction(async (tx) => {
  const week = await tx.week.findUnique({ where: { id: weekId } });
  if (!week) throw new WeekNotFoundError();

  const teams = await tx.team.findMany({ where: { weekId }, select: { id: true } });
  const teamIds = teams.map((t) => t.id);

  const matches = await tx.match.findMany({ where: { weekId }, select: { sets: true } });
  const setCount = matches.reduce((sum, m) => sum + (m.sets as SetScore[]).length, 0);

  const mvpResult = await tx.weeklyMvp.deleteMany({ where: { weekId } });
  const teamPlayerResult = teamIds.length
    ? await tx.teamPlayer.deleteMany({ where: { teamId: { in: teamIds } } })
    : { count: 0 };
  const matchResult = await tx.match.deleteMany({ where: { weekId } });
  const teamResult = await tx.team.deleteMany({ where: { weekId } });
  const attendeeResult = removeAttendees
    ? await tx.weekAttendee.deleteMany({ where: { weekId } })
    : { count: 0 };

  const status = resetStatus
    ? (await tx.week.update({ where: { id: weekId }, data: { status: 'draft' } })).status
    : week.status;

  return {
    status,
    deleted: {
      teams: teamResult.count,
      matches: matchResult.count,
      sets: setCount,
      mvps: mvpResult.count,
      attendees: attendeeResult.count,
    },
  };
});
```

Önemli noktalar:
- **Gerçek silinen sayılar** response'a gider — `deleteMany().count`, veritabanının
  fiilen sildiği satır sayısıdır; UI'dan gelen hiçbir sayıya güvenilmez.
- **Cross-week izolasyon**: her sorgu `weekId` (veya bu haftanın `teamIds`'i)
  ile filtrelenir — başka bir haftaya ait satır hiçbir sorgu tarafından
  seçilemez, bu yüzden fiziksel olarak etkilenemez.
- **Atomiklik**: `$transaction` içinde herhangi bir adım hata fırlatırsa
  Prisma tüm transaction'ı rollback eder — kısmi silme oluşmaz.
- UI'dan gelen `teamCount`/`matchCount`/`setCount`/`mvpCount`/`attendeeCount`
  değerleri **sadece confirmation dialog'da bilgilendirme amaçlıdır**; backend
  bunları hiç okumaz, kendi sayımını yapar.

## Silme sırası

```
1. WeeklyMvp.deleteMany({ weekId })
2. TeamPlayer.deleteMany({ teamId: { in: teamIds } })   -- teamIds bu haftaya ait
3. Match.deleteMany({ weekId })
4. Team.deleteMany({ weekId })
5. (removeAttendees) WeekAttendee.deleteMany({ weekId })
6. (resetStatus) Week.update({ status: 'draft' })
```

## Değiştirilecek / eklenecek dosyalar

- **Yeni** `src/app/api/admin/weeks/[id]/reset/route.ts` — `POST` handler.
- **Yeni** `src/lib/weekResetService.ts` — reset mantığını saran, Prisma
  transaction client'ı (`tx`) parametre olarak alan **test edilebilir service
  fonksiyonu** `resetWeekData(tx, weekId, options)`. Bu bir pure function
  değildir (gerçek DB yazma/okuma yapar) — proje genelinde iş mantığı
  `src/lib/` altında toplandığından (`weekDeletion.ts`, `weekView.ts`,
  `standings.ts`) mevcut yapıya uyularak `src/services/` gibi yeni bir üst
  dizin açılmıyor; isimlendirme ile (dosya adı + JSDoc üstü tek satır yorum)
  "service function" olduğu netleştiriliyor.
- **Yeni** `src/lib/weekResetPlan.ts` — `resetStatus`/`removeAttendees`
  bayraklarından hangi adımların çalışacağını ve sonuç `status` değerini
  hesaplayan **saf fonksiyon** `planWeekReset(options)`. DB'siz unit test
  edilebilir, `weekDeletion.ts`'deki `canDeleteWeek` deseniyle birebir aynı.
- **Yeni** `src/lib/weekResetPlan.test.ts` — `planWeekReset` için vitest.
- **Yeni** `src/lib/weekResetService.integration.test.ts` — bkz. Testler bölümü.
- **Değişecek** `src/components/ConfirmDialog.tsx` — `children?: React.ReactNode`
  prop'u eklenir (buton satırından önce render edilir). Mevcut 2 kullanım yeri
  (`WeekRowActions.tsx`) etkilenmez, prop opsiyonel.
- **Yeni** `src/components/WeekResetControl.tsx` — `'use client'`,
  `WeekRowActions.tsx` ile aynı state deseni (`confirmReset`/`busy`/`error`/
  `success` + `removeAttendees`/`resetStatus` checkbox state'leri).
- **Değişecek** `src/app/admin/haftalar/[id]/page.tsx` — `<WeekResetControl>`
  eklenir; `teams.length`/`matches.length`/`mvps.length`/`attendees.length`
  zaten `include` ile geliyor, `setCount` için `matches.reduce(...)` hesaplanıp
  prop olarak geçirilir (yalnızca dialog bilgilendirmesi için).

## Confirmation dialog tasarımı

```tsx
<ConfirmDialog
  open={confirmReset}
  title={`${weekDateLabel} haftasının verileri sıfırlansın mı?`}
  details={[
    { label: 'Takım', value: teamCount },
    { label: 'Maç', value: matchCount },
    { label: 'Set', value: setCount },
    { label: 'MVP kaydı', value: mvpCount },
    { label: 'Katılımcı', value: attendeeCount },
  ]}
  warning={
    resetStatus
      ? 'Bu işlem hafta kaydını ve oyuncuları silmez. Takımlar, maçlar, set skorları ve haftanın oyuncusu temizlenir ve hafta Taslak durumuna alınacaktır. Bu işlem geri alınamaz.'
      : `Bu işlem hafta kaydını ve oyuncuları silmez. Takımlar, maçlar, set skorları ve haftanın oyuncusu temizlenir; hafta durumu değişmeyecek (mevcut: ${currentStatusLabel}). Bu işlem geri alınamaz.`
  }
  confirmLabel={busy ? 'Sıfırlanıyor…' : 'Verileri Sıfırla'}
  cancelLabel="Vazgeç"
  danger
  onConfirm={handleReset}
  onCancel={() => setConfirmReset(false)}
>
  <label className="flex items-center gap-2 text-sm mb-2">
    <input type="checkbox" checked={removeAttendees} onChange={(e) => setRemoveAttendees(e.target.checked)} />
    Katılımcıları da temizle
  </label>
  <label className="flex items-center gap-2 text-sm mb-3">
    <input type="checkbox" checked={resetStatus} onChange={(e) => setResetStatus(e.target.checked)} />
    Haftayı Taslak durumuna al
  </label>
</ConfirmDialog>
```

- `removeAttendees` varsayılan `false`.
- `resetStatus` varsayılan `true`.
- Başarı sonrası: local `success` state ("Hafta verileri sıfırlandı.") +
  `router.refresh()` — server component yeniden fetch eder, sayılar ve durum
  rozeti güncel görünür.
- Buton: `src/app/admin/haftalar/[id]/page.tsx` üzerinde, `WeekStatusControl`'ün
  yanında (kullanıcı zaten o haftanın verilerine bakarken doğru bağlamda).

## Testler

Proje genelinde route-level test yok; mevcut strateji iş mantığını
`src/lib/*`'e çıkarıp DB'siz unit test etmek (`weekDeletion.test.ts` örneği).
Bu strateji `planWeekReset` için birebir uygulanabilir, ama istenen
senaryoların çoğu (cross-week izolasyon, idempotentlik, transaction
atomikliği) doğası gereği DB'ye gerçekten yazıp okumadan kanıtlanamaz. Bu
yüzden iki katman:

**`weekResetPlan.test.ts` (saf, DB'siz):**
- `resetStatus=true` → sonuç status `'draft'`
- `resetStatus=false` → sonuç status mevcut status ile aynı
- `removeAttendees` true/false adım listesini etkiliyor

**`weekResetService.integration.test.ts` (gerçek test DB'sine karşı, yeni desen —
bu repo'da ilk DB-entegrasyon testi, spec'te bilinçli bir sapma olarak işaretlendi):**
- Takım ve maç olan hafta sıfırlanır → `deleted` sayıları doğru
- `archived` durumdaki hafta sıfırlanır, `resetStatus=true` ile status `draft`
  olur, hafta kaydı korunur
- Player kayıtları hiç değişmez (reset öncesi/sonrası `Player` tablosu birebir aynı)
- Diğer haftalara ait `Team`/`TeamPlayer`/`Match`/`WeeklyMvp`/`WeekAttendee`
  kayıtları reset sonrası tamamen değişmeden kalır (ayrı bir kontrol haftası
  fixture'ı ile)
- `removeAttendees=false` → `WeekAttendee` korunur
- `removeAttendees=true` → `WeekAttendee` silinir
- İkinci kez sıfırlama idempotent: tüm `deleted` alanları `0`, hata yok, 200 döner
- Transaction ortasında zorlanan bir hata (ör. `tx.team.deleteMany` mock'lanıp
  reject ettirilir) → hiçbir tablo değişmez (rollback doğrulanır)

**Kapsam dışı bırakılan test:** "Yetkisiz erişim reddedilir" — bu davranış
route koduna değil `src/middleware.ts`'e ait ve proje genelinde hiçbir route
için ayrıca test edilmiyor; mevcut middleware davranışı değişmediği için
plan aşamasında yeni bir test eklenmeyecek, sadece spec'te dokümante edildi.

**Manuel doğrulama (UAT, plan sonrası):** admin haftalar listesinde `draft`
haftanın varsayılan filtrede (`status !== 'archived'`) göründüğü, public ana
sayfada (`getNextWeekSummary`, `status notIn ['draft','archived']`) draft
haftanın gösterilmediği — bu iki davranış zaten mevcut kodda var, yeni kod
gerektirmiyor, sadece browser'da doğrulanacak.

## Riskler

- **Çifte tıklama / TOCTOU**: `busy` state butonu disable eder; transaction
  içinde week tekrar `findUnique` ile doğrulanır. İki eşzamanlı istek de
  week'i bulur, `deleteMany` DB'de atomik ve idempotent olduğundan ikinci
  istek `0` satır siler — hata vermez, veri bozulmaz.
- **`ConfirmDialog` genişletmesi**: `children` opsiyonel prop, mevcut 2
  kullanım yeri etkilenmiyor.
- **`removeAttendees=true` sonrası TeamBuilder'ın katılımcı listesi boşalır**:
  beklenen davranış, checkbox varsayılan `false` olduğu için normal akışta
  tetiklenmez.
- **Yeni entegrasyon test deseni — somut tehlike doğrulandı**: `vitest.config.ts`
  ayrı bir test veritabanı tanımlamıyor (`include: ['src/**/*.test.ts']`,
  başka hiçbir DB ayarı yok). Yani `weekResetService.integration.test.ts`
  korumasız bırakılırsa `npm test` (`vitest run`) çalıştığında `.env`/
  `.env.local` içindeki **gerçek geliştirme veritabanına** karşı çalışır ve
  gerçek `Week`/`Team`/`Match` kayıtlarını silebilir — az önce 31.07.2026
  haftası için elle yaptığımız temizlikle aynı DB. Plan aşamasında bu dosya
  `process.env.RUN_DB_TESTS === '1'` gibi bir bayrakla korunacak ve `describe.skipIf`
  ile varsayılan `npm test` çalışmasından hariç tutulacak; sadece bilinçli
  şekilde (`RUN_DB_TESTS=1 npx vitest run weekResetService.integration.test.ts`)
  ve tercihen ayrı bir `DATABASE_URL` ile çalıştırılacak şekilde yazılacak.
  Bu, planlama aşamasında netleştirilecek zorunlu bir görev.
- **`WeekStatus` genişlemesi yok**: `'draft'` zaten `WEEK_STATUSES` içinde
  tanımlı (`src/lib/constants.ts:19`), şema/migration değişikliği gerekmiyor.
