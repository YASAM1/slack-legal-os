import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';
import { decrypt, encrypt } from '@/lib/crypto';

const CLIO_BASE_URL = process.env.CLIO_BASE_URL ?? 'https://app.clio.com';
const TOKEN_PATH = '/oauth/token';
const AUTH_PATH = '/oauth/authorize';

export interface ClioTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
}

interface ClioTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: requireEnv('CLIO_CLIENT_ID'),
    redirect_uri: requireEnv('CLIO_REDIRECT_URI'),
    state,
  });
  return `${CLIO_BASE_URL}${AUTH_PATH}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<ClioTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: requireEnv('CLIO_CLIENT_ID'),
    client_secret: requireEnv('CLIO_CLIENT_SECRET'),
    redirect_uri: requireEnv('CLIO_REDIRECT_URI'),
  });
  const res = await fetch(`${CLIO_BASE_URL}${TOKEN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Clio token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as ClioTokenResponse;
  if (!data.refresh_token) {
    throw new Error('Clio token exchange returned no refresh_token');
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSec: data.expires_in,
  };
}

export async function storeRefreshToken(refreshToken: string): Promise<void> {
  const encrypted = encrypt(refreshToken);
  await db
    .insert(schema.clioOauth)
    .values({
      id: 'singleton',
      encryptedRefreshToken: encrypted,
      lastRefreshedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.clioOauth.id,
      set: { encryptedRefreshToken: encrypted, lastRefreshedAt: new Date(), updatedAt: new Date() },
    });
  cachedAccessToken = null;
}

export async function isClioConnected(): Promise<boolean> {
  const rows = await db.select({ id: schema.clioOauth.id }).from(schema.clioOauth).limit(1);
  return rows.length > 0;
}

export async function clearClioConnection(): Promise<void> {
  await db.delete(schema.clioOauth).where(eq(schema.clioOauth.id, 'singleton'));
  cachedAccessToken = null;
}

async function refreshAccessToken(): Promise<string> {
  const rows = await db
    .select({ encryptedRefreshToken: schema.clioOauth.encryptedRefreshToken })
    .from(schema.clioOauth)
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error('Clio is not connected');
  const refreshToken = decrypt(row.encryptedRefreshToken);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: requireEnv('CLIO_CLIENT_ID'),
    client_secret: requireEnv('CLIO_CLIENT_SECRET'),
  });
  const res = await fetch(`${CLIO_BASE_URL}${TOKEN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Clio token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as ClioTokenResponse;

  // Clio may or may not rotate the refresh token on each refresh — only persist
  // if a new one was returned, otherwise keep using the existing one.
  if (data.refresh_token) {
    await storeRefreshToken(data.refresh_token);
  }

  const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  cachedAccessToken = { token: data.access_token, expiresAt };
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }
  return refreshAccessToken();
}

export async function clioFetch(
  path: string,
  init: RequestInit & { retried?: boolean } = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const url = path.startsWith('http') ? path : `${CLIO_BASE_URL}${path}`;
  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 && !init.retried) {
    cachedAccessToken = null;
    return clioFetch(path, { ...init, retried: true });
  }
  return res;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}
