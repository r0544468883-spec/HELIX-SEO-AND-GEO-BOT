// Google OAuth — read-only Search Console + Analytics (GA4 AI-traffic).
const SCOPE = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
].join(' ');

export function buildAuthUrl(state = ''): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '',
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`token_${res.status}`);
  return (await res.json()) as TokenResponse;
}

// Refresh an access token from a stored refresh token.
export async function refreshToken(refresh: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`refresh_${res.status}`);
  return (await res.json()) as TokenResponse;
}

// List the sites the connected user can access.
export async function listSites(accessToken: string): Promise<string[]> {
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { siteEntry?: { siteUrl: string }[] };
  return (json.siteEntry ?? []).map((s) => s.siteUrl);
}
