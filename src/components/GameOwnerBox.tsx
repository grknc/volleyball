'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readManageToken } from '@/lib/gameStorage';
import { CopyLinkButton } from '@/components/CopyLinkButton';

/** Oyunu bu tarayıcıdan açan kişiye yönetim bağlantısını gösterir. */
export function GameOwnerBox({ gameId }: { gameId: string }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(readManageToken(gameId));
  }, [gameId]);

  if (!token) return null;
  const managePath = `/oyunlar/${gameId}/yonet?k=${encodeURIComponent(token)}`;

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <h2 className="font-semibold mb-1">Bu oyunu siz açtınız</h2>
      <p className="text-sm text-slate-700 mb-3">
        Yönetim bağlantısını saklayın: oyunu düzenlemenin tek yolu budur ve kaybolursa geri alınamaz. Bu
        bağlantıyı başkalarıyla paylaşmayın.
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <Link href={managePath} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm">
          Oyunu yönet
        </Link>
        <CopyLinkButton path={managePath} label="Yönetim bağlantısını kopyala" />
      </div>
    </section>
  );
}
