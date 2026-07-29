export function VolleyballInfo() {
  return (
    <section className="mt-10 pt-8 border-t border-slate-200">
      <h2 className="text-lg font-semibold mb-4">Voleybol Hakkında</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded p-4">
          <SalonVoleybolIllustration />
          <h3 className="font-semibold mt-3 mb-1">Salon Voleybolu</h3>
          <p className="text-sm text-slate-600 mb-2">
            Salon voleybolu, iki takımın 6&apos;şar kişilik oyuncularla file üzerinden topu birbirine
            geçirmeye çalıştığı bir takım sporudur. Her takım topu kendi sahasında en fazla 3 kez
            oynatabilir ve aynı oyuncu üst üste iki kez topa dokunamaz.
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            <li>Bir set genellikle 25 sayıya kadar oynanır (en az 2 sayı farkla kazanılır)</li>
            <li>Maç, 5 set üzerinden 3 seti kazanan takımın galibiyetiyle sona erer (bizim haftalık organizasyonumuzda maçlar 2 set kazanma usulüyle oynanır)</li>
            <li>File yüksekliği erkeklerde 2.43 m, kadınlarda 2.24 m&apos;dir</li>
            <li>Servis hakkını rakipten alan takım saat yönünde rotasyona girer</li>
          </ul>
        </div>
        <div className="border rounded p-4">
          <PlajVoleybolIllustration />
          <h3 className="font-semibold mt-3 mb-1">Plaj Voleybolu</h3>
          <p className="text-sm text-slate-600 mb-2">
            Plaj voleybolu, kum saha üzerinde 2&apos;şer kişilik takımların oynadığı, salon
            voleybolunun daha dinamik bir versiyonudur. Sahanın küçük olması nedeniyle her oyuncu
            çok daha fazla topla temas eder.
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            <li>Takımlar 2 oyuncudan oluşur, yedek veya oyuncu değişikliği yoktur</li>
            <li>Bir set 21 sayıya kadar oynanır (2 fark şartıyla), gerekirse 3. set 15 sayıya kadardır</li>
            <li>File yüksekliği salon voleybolu ile aynıdır</li>
            <li>Güneş/rüzgar avantajını dengelemek için taraflar belirli sayı aralıklarında değişir</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function SalonVoleybolIllustration() {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-28 text-slate-400" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="10" y1="120" x2="190" y2="120" stroke="currentColor" strokeWidth="2" />
      <line x1="60" y1="30" x2="60" y2="120" stroke="currentColor" strokeWidth="3" />
      <line x1="140" y1="30" x2="140" y2="120" stroke="currentColor" strokeWidth="3" />
      <line x1="60" y1="40" x2="140" y2="40" stroke="currentColor" strokeWidth="2" />
      <line x1="60" y1="70" x2="140" y2="70" stroke="currentColor" strokeWidth="2" />
      {[70, 80, 90, 100, 110, 120, 130].map((x) => (
        <line key={x} x1={x} y1="40" x2={x} y2="70" stroke="currentColor" strokeWidth="1" />
      ))}
      <circle cx="100" cy="20" r="14" stroke="#f59e0b" strokeWidth="2" fill="#fef3c7" />
      <path d="M90 12 Q100 20 90 28" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
      <path d="M110 12 Q100 20 110 28" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function PlajVoleybolIllustration() {
  const sunRays = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const angle = (i * Math.PI) / 4;
    const x1 = 150 + Math.cos(angle) * 22;
    const y1 = 30 + Math.sin(angle) * 22;
    const x2 = 150 + Math.cos(angle) * 28;
    const y2 = 30 + Math.sin(angle) * 28;
    return { key: i, x1, y1, x2, y2 };
  });

  return (
    <svg viewBox="0 0 200 140" className="w-full h-28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="150" cy="30" r="16" fill="#fbbf24" />
      {sunRays.map((ray) => (
        <line key={ray.key} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} stroke="#fbbf24" strokeWidth="2" />
      ))}
      <path d="M10 110 Q40 100 70 110 T130 110 T190 110" stroke="#d4a373" strokeWidth="2" fill="none" />
      <path d="M10 125 Q40 115 70 125 T130 125 T190 125" stroke="#d4a373" strokeWidth="2" fill="none" />
      <circle cx="55" cy="80" r="18" stroke="#0ea5e9" strokeWidth="2" fill="#e0f2fe" />
      <path d="M55 62 A18 18 0 0 1 55 98" stroke="#0ea5e9" strokeWidth="1.5" fill="none" />
      <path d="M37 80 A18 18 0 0 1 73 80" stroke="#0ea5e9" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
