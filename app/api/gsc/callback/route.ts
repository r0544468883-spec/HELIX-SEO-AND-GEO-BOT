import { NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/gsc-oauth';

export const dynamic = 'force-dynamic';

// OAuth callback — exchange the code for tokens and store them in secure cookies.
// (MVP: cookie-based. Later: persist refresh_token to site_connections per user.)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/?gsc=error', url.origin));

  try {
    const tok = await exchangeCode(code);
    const res = NextResponse.redirect(new URL('/?gsc=connected', url.origin));
    const secure = url.protocol === 'https:';
    res.cookies.set('gsc_token', tok.access_token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: tok.expires_in ?? 3600,
      path: '/',
    });
    if (tok.refresh_token) {
      res.cookies.set('gsc_refresh', tok.refresh_token, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90,
        path: '/',
      });
    }
    return res;
  } catch {
    return NextResponse.redirect(new URL('/?gsc=error', url.origin));
  }
}
