'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const LINKS = [
  { href: '/', label: 'Ana Sayfa' },
  { href: '/oyunlar', label: 'Oyun Bul' },
  { href: '/players', label: 'Oyuncular' },
  { href: '/statistics', label: 'İstatistikler' },
  { href: '/arsiv', label: 'Geçmiş Haftalar' },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <nav className="mb-5 -mx-4 sm:mx-0 sm:rounded-2xl bg-blue-700 text-white px-4 py-3 shadow-sm">
      <div className="flex justify-between items-center">
        <Link href="/" className="font-black tracking-[0.2em] text-sm">
          🏐 VOLEYBOL
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Menüyü aç/kapat"
          className="sm:hidden rounded-lg px-2 py-1 hover:bg-white/10"
        >
          ☰
        </button>
        <div className="hidden sm:flex gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm rounded-full px-3 py-1 ${isActive(link.href) ? 'bg-white text-blue-800 font-semibold' : 'hover:bg-white/10'}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      {open && (
        <div className="sm:hidden flex flex-col gap-1 mt-2 border-t border-white/20 pt-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm rounded-lg px-2 py-1.5 ${isActive(link.href) ? 'bg-white text-blue-800 font-semibold' : ''}`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
