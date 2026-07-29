# Ana Sayfa Voleybol Bilgi Bölümü — Design

**Problem:** Ana sayfa (`/`), özellikle henüz hafta eklenmemişken veya az veri varken, çok boş görünüyor. Ziyaretçiye siteyle ilgisi olan (voleybol hakkında) tamamlayıcı bir bilgi bölümü ekleyerek sayfayı daha dolu ve tanıtıcı hale getirmek istiyoruz.

**Kapsam:** Sadece ana sayfaya statik bir bilgi bölümü eklemek. Yeni bir route, veritabanı değişikliği veya admin yönetimi yok — içerik kod içinde sabit (hardcoded).

## Bileşen

`src/components/VolleyballInfo.tsx` — prop almayan, statik içerikli bir React server component. `<VolleyballInfo />` olarak dışa aktarılır.

## İçerik Yapısı

İki kart, `grid grid-cols-1 md:grid-cols-2 gap-6` içinde yan yana (mobilde alt alta):

1. **Salon Voleybolu**
   - Inline SVG illustrasyon (file + top, salon zemini çizgileri)
   - 2-3 cümlelik kısa tanıtım: 6 kişilik takımlar, 3 dokunuş kuralı, standart file yüksekliği
   - 3-4 maddelik temel kural listesi (set kazanma sayısı, rotasyon, dokunuş hakkı vb.)

2. **Plaj Voleybolu**
   - Inline SVG illustrasyon (güneş, kum, top)
   - 2-3 cümlelik kısa tanıtım: 2 kişilik takımlar, kum saha, salon voleybolundan farkı
   - 3-4 maddelik temel kural listesi

Kartların üstünde ortak bir bölüm başlığı: "Voleybol Hakkında".

## Yerleşim

`src/app/page.tsx` içinde, mevcut hafta içeriğinin (`WeekViewLoader` ya da "Henüz hafta eklenmedi" mesajı) **altına**, koşulsuz olarak (`!latestWeek` dalından bağımsız, her zaman) render edilir. Böylece veri olsun olmasın sayfa dolu görünür.

## Stil

Mevcut Tailwind diliyle tutarlı: `WeekView.tsx`'teki section yapısına benzer (`<section>`, `text-lg font-semibold` başlık, `border rounded p-4` kart gövdesi, `slate` renk tonları). SVG'ler `currentColor`/basit dolgularla, sitenin `slate`/`amber` paletiyle uyumlu, harici asset veya link olmadan inline tanımlanır.

## Test Stratejisi

Bu statik/sunum amaçlı bir bileşen olduğu için proje genelindeki test stratejisine göre (`src/lib/*` dışındaki her şey manuel doğrulanıyor) otomatik Vitest testi gerekmiyor. Doğrulama `npm run dev` ile tarayıcıda görsel kontrol şeklinde yapılacak: iki kartın da göründüğü, SVG'lerin render edildiği, mobil genişlikte kartların alt alta dizildiği kontrol edilecek.

## Kapsam Dışı

- Admin panelinden düzenlenebilir içerik (şimdilik statik)
- Gerçek fotoğraf/harici görsel kaynağı
- Ayrı bir "hakkında" sayfası
