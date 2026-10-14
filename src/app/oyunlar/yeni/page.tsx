import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { GameForm } from '@/components/GameForm';

export const metadata: Metadata = { title: 'Oyun Oluştur' };

export default function NewGamePage() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <Link href="/oyunlar" className="text-sm underline">← Tüm oyunlar</Link>
      <h1 className="text-xl font-bold mt-2 mb-4">Oyun Oluştur</h1>
      <GameForm />
    </main>
  );
}
