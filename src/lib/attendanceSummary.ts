/** Ana sayfadaki tek satırlık katılım şeridinin metni (büyük panel haftanın sayfasında). */
export function attendanceSummary(args: {
  coming: number;
  /** null = sınırsız */
  capacity: number | null;
  waitlist: number;
  open: boolean;
}): { text: string; linkLabel: string } {
  const count = args.capacity === null ? `${args.coming}` : `${args.coming}/${args.capacity}`;
  const waitlist = args.waitlist > 0 ? ` · ${args.waitlist} yedek` : '';
  return {
    text: `Katılım: ${count} geliyor${waitlist}`,
    linkLabel: args.open ? 'Katılım durumunu bildir →' : 'Katılım listesini gör →',
  };
}
