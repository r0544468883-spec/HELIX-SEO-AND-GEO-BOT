import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/gsc-oauth';

export const dynamic = 'force-dynamic';

// Kick off the GSC OAuth flow — redirect the user to Google's consent screen.
export async function GET() {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
    return NextResponse.json({ error: 'gsc_oauth_not_configured' }, { status: 500 });
  }
  return NextResponse.redirect(buildAuthUrl());
}
