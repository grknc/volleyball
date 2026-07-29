# Ana Sayfada Takım Kadrosu Gösterimi — Design

**Problem:** Ana sayfadaki (`/`) ve hafta detay sayfasındaki (`/hafta/[weekId]`) Puan Durumu tablosu ve Maç Sonuçları listesi sadece takım isimlerini gösteriyor. Ziyaretçi, o takımda hangi oyuncuların olduğunu göremiyor.

**Kapsam:** Sadece `src/components/WeekView.tsx` içinde görsel/etkileşim değişikliği. Yeni bir veritabanı sorgusu veya API endpoint'i gerekmiyor — `WeekViewData.teams[].players` verisi zaten `getWeekView` (`src/lib/weekView.ts`, Task 14'te oluşturuldu) tarafından dolduruluyor ve `WeekView`'e prop olarak geliyor.

## Davranış

Puan Durumu tablosundaki ve Maç Sonuçları listesindeki her takım ismi, native HTML `<details>/<summary>` elemanına dönüşür:
- Kapalıyken sadece takım adı görünür (görsel olarak neredeyse aynı, altı noktalı çizgiyle tıklanabilir olduğu ima edilir).
- Tıklanınca/summary'ye basılınca hemen altında o takımın oyuncu listesi (`isim (Seviye N)`) açılır.
- JavaScript/client component gerekmez — `<details>` tarayıcı native davranışı kullanır, `WeekView` server component olarak kalır.

## Bileşen Değişikliği

`src/components/WeekView.tsx` içine yeni, dışa aktarılmayan bir yardımcı bileşen eklenir:

```tsx
function TeamRoster({ teamId, week }: { teamId: string; week: WeekViewData }) {
  const team = week.teams.find((t) => t.id === teamId);
  if (!team) return <>{teamId}</>;
  return (
    <details className="inline-block">
      <summary className="cursor-pointer underline decoration-dotted">{team.name}</summary>
      <ul className="mt-1 list-disc list-inside text-xs text-slate-500 font-normal">
        {team.players.map((p) => (
          <li key={p.id}>
            {p.name} (Seviye {p.level})
          </li>
        ))}
      </ul>
    </details>
  );
}
```

Mevcut `teamName(id)` yardımcı fonksiyonu (`WeekView.tsx:4-6`) kaldırılır — hem standings tablosunda hem maç sonuçlarında artık `TeamRoster` kullanılacağı için gereksiz kalıyor.

**Puan Durumu tablosu (`WeekView.tsx:28`):** `{row.teamName}` yerine `<TeamRoster teamId={row.teamId} week={week} />`.

**Maç Sonuçları listesi (`WeekView.tsx:46`):** `{teamName(match.teamAId)} - {teamName(match.teamBId)}:` yerine `<TeamRoster teamId={match.teamAId} week={week} /> - <TeamRoster teamId={match.teamBId} week={week} />:`.

## Bilinen Görsel Ödün

Maç Sonuçları satırı kapalıyken aynı görünür ("TakımA - TakımB: 2-0 (...)"), ama bir takım açıldığında o takımın oyuncu listesi hemen altında beliriyor ve satırın o kısmı genişliyor/kayıyor. Bu, JS'siz bir çözümün kabul edilen küçük bir görsel ödünüdür — kullanıcı onayladı.

## Test Stratejisi

Bu değişiklik pure presentation'dır (yeni iş mantığı yok, sadece mevcut `week.teams[].players` verisinin gösterimi). Proje test stratejisine göre otomatik test gerekmiyor — `npm run build` + `npm run dev` ile tarayıcıda manuel doğrulama yeterli: hem `/` hem `/hafta/[weekId]` sayfalarında takım isimlerine tıklayınca oyuncu listesinin açıldığı, tekrar tıklayınca kapandığı kontrol edilecek.

## Kapsam Dışı

- Maç sonuçları satırının görsel yeniden düzenlenmesi (örn. takım isimlerini alt alta taşımak) — kullanıcı ileride isterse ayrı bir iyileştirme olarak ele alınabilir.
- Oyuncu satırına tıklayınca oyuncu detay sayfasına gitme gibi ek etkileşimler.
