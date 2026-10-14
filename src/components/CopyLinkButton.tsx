'use client';

import { useState } from 'react';

/** `path` site içi bir yoldur ("/oyunlar/abc"); tam adres tarayıcıda oluşturulur. */
export function CopyLinkButton({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  async function handleCopy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano erişimi yoksa (http, eski tarayıcı) adresi elle kopyalanacak şekilde göster.
      setFallbackUrl(url);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        {copied ? 'Kopyalandı ✓' : label}
      </button>
      {fallbackUrl && (
        <input
          readOnly
          value={fallbackUrl}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Bağlantı"
          className="border rounded px-2 py-1 text-sm w-full"
        />
      )}
    </div>
  );
}
