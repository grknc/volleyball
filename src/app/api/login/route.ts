import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials } from '@/lib/auth';
import { createSessionToken, SESSION_COOKIE } from '@/lib/session';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 });
  }
  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: 'Hatalı e-posta veya şifre' }, { status: 401 });
  }
  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
