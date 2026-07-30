'use client';

import Link from 'next/link';
import { useState } from 'react';

const LINKS = [
  { href: '/', label: 'Ana Sayfa' },
  { href: '/players', label: 'Oyuncular' },
  { href: '/statistics', label: 'İstatistikler' },
  { href: '/arsiv', label: 'Geçmiş Haftalar' },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="mb-6">
      <div className="flex justify-between items-center">
        <span className="font-bold">Haftalık Voleybol</span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Menüyü aç/kapat"
          className="sm:hidden border rounded px-2 py-1"
        >
          ☰
        </button>
        <div className="hidden sm:flex gap-4">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="underline text-sm">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      {open && (
        <div className="sm:hidden flex flex-col gap-2 mt-2 border-t pt-2">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="underline text-sm" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
