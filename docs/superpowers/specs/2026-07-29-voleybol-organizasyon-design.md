# Haftalık Voleybol Organizasyonu — Tasarım

## Amaç

Organizatör (tek admin) her hafta 10-30 oyuncunun katıldığı amatör voleybol etkinliğini yönetiyor. Oyuncular kendi aralarında maç yapıyor. İhtiyaç: oyuncu veritabanı, haftalık takım kurma (seviyeye göre dengeli), maç sonuçlarının girilmesi ve bunların Mackolik tarzı bir "puan durumu / maç sonucu / haftanın oyuncusu" görünümüyle herkese açık şekilde yayınlanması.

## Kapsam dışı (YAGNI)

- Oyuncu girişi / kendi hesabı — yok, tek admin (organizatör) yönetir.
- Sezonluk toplam puan durumu / lig tablosu — yok, her hafta bağımsız ve kendi içinde sıfırdan.
- Otomatik/istatistiksel MVP hesaplama — yok, haftanın oyuncusu tamamen organizatörün elle seçimi.
- Sabit takım sayısı/boyutu kuralı — yok, organizatör her hafta serbestçe karar verir.
- Sabit fikstür (round robin zorunluluğu) — yok, organizatör hangi takımın hangi takımla oynayacağını elle belirler.

## Veri Modeli

- **Player (Oyuncu)**: id, isim, seviye (1-10), aktif/pasif (soft-hide, silinmez), created_at
- **Week (Hafta)**: id, tarih, katılımcı oyuncu listesi (o hafta gelenler)
- **Team (Takım)**: id, week_id, isim, oyuncu kadrosu (o haftaya özel, her hafta yeniden kurulur)
- **Match (Maç)**: id, week_id, team_a_id, team_b_id, set skorları (her set için iki takımın sayısı, ör. [[25,20],[23,25],[15,10]])
- **WeeklyMVP (Haftanın Oyuncusu)**: week_id, player_id (bir haftada birden fazla olabilir)

Maçın kazananı ve puanı set skorlarından otomatik hesaplanır (aşağıdaki puanlama kuralına göre); elle girilmez.

## Kullanıcı Akışı (Admin)

1. Oyuncu veritabanını yönetir: ekle / düzenle / pasife al. Seviye 1-10 arası.
2. Yeni bir "hafta" açar, o hafta gelen oyuncuları işaretler.
3. Kaç takım / takım başı kaç kişi istediğini belirtir → sistem, katılımcıları seviyeye göre sıralayıp yılan (snake draft) usulü takımlara dağıtarak dengeli bir öneri sunar. Admin isterse oyuncuları takımlar arası elle taşıyabilir, takımlara isim verir.
4. Fikstürü elle belirler: hangi takım hangi takımla oynayacak (serbest, round-robin zorunlu değil).
5. Her maç için set skorlarını girer. Sistem otomatik olarak maçın kazananını ve puanını hesaplar.
6. O hafta için bir veya daha fazla "haftanın oyuncusu" seçer.

## Herkese Açık Sayfalar

- **Ana sayfa / Güncel hafta**: o haftanın takımları, maç sonuçları (set skorlarıyla), puan durumu tablosu, haftanın oyuncusu.
- **Puan durumu tablosu**: Takım / Oynadı / Galibiyet / Mağlubiyet / Puan / Set averajı. Sıralama: Puan, eşitlikte set averajı.
- **Arşiv**: geçmiş haftaların listesi; her biri seçilip o haftanın takımları/sonuçları/puan durumu/haftanın oyuncusu görüntülenebilir.

Bu sayfalar login gerektirmez, herkese açık bir linkle paylaşılır.

## Puanlama Kuralı

- Maç 2-0 biterse: kazanana 3 puan, kaybedene 0 puan.
- Maç 2-1 biterse: kazanana 2 puan, kaybedene 0 puan.
- Puan durumu her hafta bağımsız hesaplanır, hafta değişince sıfırdan başlar.

## Teknik Mimari

- **Next.js (App Router, TypeScript)** — admin panel ve herkese açık sayfalar tek projede.
- **Tailwind CSS** — Mackolik tarzı tablo/kart görünümü.
- **PostgreSQL** (Neon veya Supabase ücretsiz katman) + **Prisma ORM**.
- **Admin girişi**: tek admin hesabı, email + şifre ile korunan `/admin` rotaları. Herkese açık sayfalar login gerektirmez.
- **Deployment**: Vercel ücretsiz katman, tek link ile paylaşım.

## Takım Dengeleme Algoritması

Katılımcılar seviyeye göre büyükten küçüğe sıralanır, takımlara yılan (snake) usulü dağıtılır (1-2-3-4-4-3-2-1 sırasıyla) böylece takımların toplam seviye puanı birbirine yakın çıkar. Bu sadece bir öneridir; admin sonrasında elle oyuncu takas edebilir.
