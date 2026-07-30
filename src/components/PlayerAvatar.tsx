'use client';

import { useState } from 'react';

interface PlayerAvatarProps {
  name: string;
  avatarUrl: string | null;
  sizeClassName?: string;
}

export function PlayerAvatar({ name, avatarUrl, sizeClassName = 'w-10 h-10' }: PlayerAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (avatarUrl && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatarUrl is an arbitrary admin-entered external domain; next/image would require a remotePatterns allowlist per domain, which isn't practical here.
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImageFailed(true)}
        className={`${sizeClassName} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClassName} rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-medium`}
      aria-label={name}
    >
      {initials || '?'}
    </div>
  );
}
