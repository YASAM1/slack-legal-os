import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildAuthorizeUrl } from '@/lib/clio/client';

const STATE_COOKIE = 'clio_oauth_state';

export async function GET() {
  const state = randomBytes(24).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return NextResponse.redirect(buildAuthorizeUrl(state));
}
