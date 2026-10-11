# Oyun Bul / Oyun Oluştur — Tasarım

Tarih: 2026-10-11

## Amaç

Bağlantıyı alan herkesin, hesap açmadan, bir voleybol oyunu açabilmesi ve
açılmış oyunlara katılabilmesi. Öncelik oyun açmayı ve katılmayı
kolaylaştırmak; ödeme uygulama dışında (PayPal/IBAN) devam eder.

Başarı ölçütü: biri oyun açar, bağlantıyı paylaşır, başkaları adını yazarak
katılır, kontenjan dolunca gelenler yedeğe düşer, biri ayrılınca sıradaki
yedek kesin listeye geçer ve herkes o an kişi başı ne ödeyeceğini görür.

## Kapsam dışı

- Kullanıcı hesabı, kayıt, giriş
- Uygulama içi ödeme toplama, otomatik saha rezervasyonu
- Bildirim (e-posta, push, WhatsApp). Yedekten kesin listeye geçen kişi bunu
  sayfaya bakınca görür.
- Spam önleme (rate limit, captcha). Sorun çıkarsa ayrıca ele alınır; o
  zamana kadar tek araç admin'in oyun silebilmesidir.
- Mevcut `Week` / `Player` / istatistik / seviye yapısıyla herhangi bir bağ.
  Bu oyunlar istatistiklere ve seviyelere yansımaz.

## Kararlar

| Konu | Karar |
|---|---|
| Kim kullanır | Bağlantıyı alan herkes, hesap olmadan |
| Organizatör yetkisi | Oyun açılınca verilen gizli yönetim bağlantısı |
| Katılımcı kimliği | Sadece ad; ayrılma anahtarı tarayıcıda saklanır |
| Ücret | Toplam saha bedeli girilir; kişi başı o an kesin katılan sayısına göre hesaplanır |
| Organizatör | Oyuncudur, ilk katılımcı olarak bir kontenjan kaplar |
| Para birimi / saat dilimi | € / Europe/Berlin |
| İletişim bilgisi | Herkese açık görünür |

## Veri modeli

Mevcut tablolara dokunulmaz. İki yeni model:

```prisma
model Game {
  id               String            @id @default(cuid())
  venue            String
  startsAt         DateTime
  capacity         Int
  totalCostCents   Int
  organizerFree    Boolean           @default(false)
  organizerName    String
  organizerContact String
  paymentNote      String?
  /// "searching" | "reserved" | "cancelled"
  status           String            @default("searching")
  manageTokenHash  String
  createdAt        DateTime          @default(now())
  participants     GameParticipant[]

  @@index([startsAt])
}

model GameParticipant {
  id             String   @id @default(cuid())
  gameId         String
  name           String
  /// Küçük harfe çevrilmiş ad; aynı oyunda aynı adı engeller.
  nameKey        String
  isOrganizer    Boolean  @default(false)
  /// Organizatör satırında null (organizatör ayrılamaz).
  leaveTokenHash String?
  createdAt      DateTime @default(now())
  game           Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)

  @@unique([gameId, nameKey])
  @@index([gameId, createdAt])
}
```

**Yedek listesi ayrı tablo değildir.** Katılımcılar `(createdAt, id)` sırasına
göre dizilir; ilk `capacity` kişi kesin, kalanı yedektir. Sonuçları:

- Biri ayrılınca ya da çıkarılınca sıradaki yedek kendiliğinden kesin olur;
  ayrı bir "terfi" adımı ve eşzamanlı katılımda kontenjan aşımı yoktur.
- Organizatör kontenjanı düşürürse en son katılanlar yedeğe düşer; artırırsa
  yedeğin başındakiler kesin olur.

Para kuruş cinsinden tam sayı olarak saklanır (`totalCostCents`).

## Kimlik ve yetki

Anahtarlar 32 baytlık rastgele değerlerdir (base64url). Veritabanında
yalnızca SHA-256 hash'i tutulur; karşılaştırma sabit zamanlıdır.

- **Yönetim anahtarı.** Oyun oluşturulunca bir kez döner. Tarayıcıda
  `localStorage`'a (`oyun:<id>:manage`) yazılır ve yönetim bağlantısı
  (`/oyunlar/<id>/yonet?k=<anahtar>`) organizatöre kopyalanabilir biçimde
  gösterilir. Kaybedilirse geri alınamaz; oyun yalnızca admin tarafından
  silinebilir.
- **Ayrılma anahtarı.** Katılınca döner, `localStorage`'a
  (`oyun:<id>:leave` → `{ participantId, token }`) yazılır. "Ayrıl" düğmesi
  yalnızca bu kayıt varsa görünür.
- **Admin.** Mevcut admin oturumu (`/api/admin/*`, middleware korumalı)
  herhangi bir oyunu silebilir.

Organizatör satırı çıkarılamaz ve ayrılamaz; organizatör oynamayacaksa oyunu
iptal eder.

## Ücret hesabı

```
ödeyen      = kesinKatılan − (organizerFree ? 1 : 0)
kişiBaşı    = totalCostCents / ödeyen            (ödeyen = 0 ise gösterilmez)
dolunca     = totalCostCents / (capacity − (organizerFree ? 1 : 0))
```

- Yedekler ödeyen sayılmaz.
- Kuruşa yuvarlanır (en yakın). Gösterim `tr-TR`, `EUR`.
- Detayda üç değer görünür: toplam saha bedeli, şu an kişi başı, dolunca
  kişi başı. "Organizatör ödemez" işaretliyse bu da açıkça yazılır.
- Örnek: 60 €, 12 kişilik, organizatör ödemez, 8 kesin katılımcı →
  şu an 8,57 €, dolunca 5,45 €.
- Toplam bedel 0 ise "Ücretsiz" gösterilir.

## Durum

- `searching` → "Oyuncu aranıyor" (varsayılan)
- `reserved` → "Saha rezerve edildi"
- `cancelled` → "İptal edildi"

Durumu yalnızca organizatör değiştirir. Kontenjan dolması durumu değiştirmez;
"Dolu" ayrı bir etikettir. İptal edilmiş ya da başlangıç saati geçmiş oyuna
katılınamaz; ayrılmak mümkündür.

## Sayfalar

| Yol | İçerik |
|---|---|
| `/oyunlar` | Yaklaşan (`startsAt >= şimdi`, iptal edilmemiş) oyunlar, tarihe göre artan. Her kartta saha, tarih/saat, doluluk (`8/12`), şu an kişi başı ücret, durum ve varsa "Dolu" etiketi. Üstte "Oyun Oluştur" düğmesi. Boşsa açıklama + düğme. |
| `/oyunlar/yeni` | Oluşturma formu. |
| `/oyunlar/[id]` | Detay: saha, tarih/saat, durum, ücret dökümü, ödeme notu, organizatör adı + iletişim, kesin katılımcılar, yedekler (sıra numaralı), Katıl formu / Ayrıl düğmesi, "Bağlantıyı kopyala". Oluşturmanın hemen ardından yönetim bağlantısı kutusu gösterilir. Tarayıcıda yönetim anahtarı varsa "Oyunu yönet" bağlantısı görünür. |
| `/oyunlar/[id]/yonet?k=…` | Anahtar sunucuda doğrulanır; geçersizse 404. Bilgileri düzenleme, durum değiştirme, katılımcı çıkarma, iptal. |
| `/admin/oyunlar` | Tüm oyunların listesi ve "Sil" (mevcut `ConfirmDialog` ile). Admin menüsüne "Oyunlar" bağlantısı eklenir. |

`PublicNav`'a `{ href: '/oyunlar', label: 'Oyun Bul' }` eklenir.

Tüm sayfalar mevcut sayfalar gibi `force-dynamic` sunucu bileşenidir;
etkileşimli kısımlar (form, katıl/ayrıl, kopyala, yönetim) istemci
bileşenidir.

## API

| Yöntem ve yol | Yetki | İş |
|---|---|---|
| `POST /api/games` | yok | Oyunu ve organizatör katılımcısını tek transaction'da oluşturur. `{ id, manageToken }` döner. |
| `PATCH /api/games/[id]` | `x-manage-token` | Gövde `{ game?, status? }`: oyun bilgilerinin tamamını ve/veya durumu günceller. |
| `POST /api/games/[id]/participants` | yok | `{ name }` → `{ participantId, leaveToken, placement: 'confirmed' \| 'waitlisted', waitlistPosition }` |
| `DELETE /api/games/[id]/participants/[pid]` | `x-leave-token` (kendi satırı) veya `x-manage-token` | Katılımcıyı siler. Organizatör satırı için 400. |
| `DELETE /api/admin/games/[id]` | admin oturumu | Oyunu siler (katılımcılar cascade). |

Hata yanıtları mevcut biçimde: `{ error: '<Türkçe mesaj>' }` ve uygun durum
kodu (400 doğrulama, 403 yanlış anahtar, 404 bulunamadı, 409 katılım kapalı
ya da aynı ad).

## Doğrulama

| Alan | Kural |
|---|---|
| Saha | 2–120 karakter |
| Tarih + saat | Europe/Berlin yerel saati olarak girilir, UTC'ye çevrilir; oluştururken gelecekte olmalı |
| Kontenjan | Tam sayı, `CAPACITY_MIN`–`CAPACITY_MAX` (4–60, `src/lib/capacity.ts`) |
| Toplam saha bedeli | 0–10 000 €, en fazla iki ondalık; virgül ve nokta kabul edilir |
| Organizatör adı, katılımcı adı | 2–40 karakter, kırpılmış |
| İletişim | 3–120 karakter, serbest metin (telefon, WhatsApp, e-posta…) |
| Ödeme notu | İsteğe bağlı, en fazla 300 karakter |

Aynı oyunda aynı ad (kırpılmış, büyük/küçük harf duyarsız) ikinci kez
kullanılamaz; yanlışlıkla çift katılımı (çift tıklama dahil) engeller. Bunu
veritabanındaki `(gameId, nameKey)` tekil kısıtı garanti eder.

Kullanıcı metni her yerde düz metin olarak basılır (React varsayılan
kaçışlaması); iletişim ve ödeme notu bağlantıya çevrilmez.

## Saat dilimi

Sunucu UTC'de çalışır (Vercel). Form tarih ve saati ayrı alanlar olarak
gönderir; sunucu bunları Europe/Berlin yerel saati sayıp UTC'ye çevirir
(yaz/kış saati `Intl.DateTimeFormat` ile hesaplanır, yeni bağımlılık yok).
Gösterimde her zaman `timeZone: 'Europe/Berlin'`, `tr-TR` kullanılır.

## Dosyalar

Yeni:

- `prisma/migrations/<ts>_add_games/migration.sql`
- `src/lib/games.ts` — saf fonksiyonlar: kesin/yedek ayrımı, ücret hesabı,
  girdi doğrulama, durum etiketleri
- `src/lib/games.test.ts`
- `src/lib/berlinTime.ts`, `src/lib/berlinTime.test.ts`
- `src/lib/gameTokens.ts`, `src/lib/gameTokens.test.ts` — üretme, hash, doğrulama
- `src/lib/gameService.ts` — Prisma erişimi (oluştur, getir, listele,
  güncelle, katıl, çıkar, sil)
- `src/app/oyunlar/page.tsx`, `yeni/page.tsx`, `[id]/page.tsx`, `[id]/yonet/page.tsx`
- `src/app/admin/oyunlar/page.tsx`
- `src/app/api/games/route.ts`, `[id]/route.ts`,
  `[id]/participants/route.ts`, `[id]/participants/[pid]/route.ts`
- `src/app/api/admin/games/[id]/route.ts`
- `src/components/GameForm.tsx` (oluşturma ve düzenlemede ortak),
  `GameCard.tsx`, `GameJoinPanel.tsx`, `GameManagePanel.tsx`,
  `CopyLinkButton.tsx`, `AdminGameDeleteButton.tsx`

Değişen:

- `prisma/schema.prisma` — iki model
- `src/components/PublicNav.tsx` — menü bağlantısı
- `src/app/admin/layout.tsx` — admin menü bağlantısı

## Test

Birim (vitest, mevcut düzen):

- Kesin/yedek ayrımı: kontenjan altı, tam dolu, aşım, ayrılma sonrası sıra,
  kontenjan düşürme/artırma
- Ücret: organizatör öder/ödemez, tek katılımcı, ödeyen 0, bedel 0, yuvarlama
- Doğrulama: her alanın sınırları, virgüllü tutar, geçmiş tarih, aynı ad
- Berlin saati: yaz ve kış saatinde çevirme, geçiş günleri
- Anahtar: hash eşleşmesi, yanlış anahtar reddi

Elle (tarayıcıda, yerel sunucu): oluştur → yönetim bağlantısı görünür →
başka tarayıcı profilinden katıl → kontenjanı doldur → yedeğe düş → biri
ayrılsın, yedek kesin olsun → ücret değişsin → durumu "Saha rezerve edildi"
yap → iptal et → admin'den sil.
