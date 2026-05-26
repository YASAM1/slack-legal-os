import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

const token = process.env.SLACK_BOT_TOKEN!;

// auth.test responds with bot identity but not scopes. To get scopes,
// hit any endpoint and inspect the response headers for x-oauth-scopes.
const r = await fetch('https://slack.com/api/auth.test', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
const body = await r.json();
console.log('auth.test:', body);
console.log('x-oauth-scopes header:', r.headers.get('x-oauth-scopes'));
console.log('x-accepted-oauth-scopes header:', r.headers.get('x-accepted-oauth-scopes'));
