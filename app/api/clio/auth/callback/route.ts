import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { exchangeCodeForTokens, storeRefreshToken } from '@/lib/clio/client';

const STATE_COOKIE = 'clio_oauth_state';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/integrations?clio_error=${encodeURIComponent(error)}`, req.url),
    );
  }
  if (!code || !state) {
    return new NextResponse('Missing code or state', { status: 400 });
  }

  const cookieStore = await cookies();
  const stored = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  if (!stored || stored !== state) {
    return new NextResponse('Invalid OAuth state (CSRF check failed)', { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await storeRefreshToken(tokens.refreshToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(`/admin/integrations?clio_error=${encodeURIComponent(msg)}`, req.url),
    );
  }

  return NextResponse.redirect(new URL('/admin/integrations?clio_connected=1', req.url));
}
