'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Giriş başarısız');
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  return (
    <main className="max-w-sm mx-auto mt-24 p-6">
      <h1 className="text-xl font-bold mb-4">Yönetici Girişi</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Kullanıcı adı"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-2">
          Giriş Yap
        </button>
      </form>
    </main>
  );
}
