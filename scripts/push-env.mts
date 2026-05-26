/**
 * Bulk-push environment variables from .env.local to Vercel.
 *
 *   pnpm env:push                      # add to Production (skips vars that already exist)
 *   pnpm env:push --dry-run            # show what would be pushed, call nothing
 *   pnpm env:push --force              # overwrite vars that already exist (rm + add)
 *   pnpm env:push preview development  # target other environments instead of production
 *
 * Safety:
 *  - Never pushes Neon/Postgres vars — those are managed by the Neon Vercel
 *    integration, and your local copies are placeholders. Pushing them would
 *    clobber the working DB connection.
 *  - Skips empty values and obvious placeholder stubs (e.g. `xoxb-`, `<paste>`).
 *  - Non-destructive by default: existing vars are reported and skipped unless
 *    you pass --force.
 */
import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ENV_FILE = '.env.local';

// Managed by the Neon (Postgres) Vercel integration — do NOT push from a local
// file or you'll overwrite the values the integration injected into Vercel.
const NEON_MANAGED = /^(DATABASE_URL|POSTGRES|PG[A-Z]|NEON|VITE_NEON)/;

function placeholderReason(value: string): string | null {
  if (value === '') return 'empty';
  if (/^<.*>$/.test(value)) return 'placeholder (<...>)';
  if (/-$/.test(value)) return 'placeholder stub (ends with "-")';
  if (value === 'you@example.com') return 'example value';
  return null;
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const targets = argv.filter((a) => !a.startsWith('--'));
const environments = targets.length ? targets : ['production'];

let raw: string;
try {
  raw = readFileSync(ENV_FILE, 'utf8');
} catch {
  console.error(`✗ Could not read ${ENV_FILE}. Run this from the project root after filling it in.`);
  process.exit(1);
}

const entries = Object.entries(parse(raw));
const toPush: [string, string][] = [];
const skipped: [string, string][] = [];

for (const [key, value] of entries) {
  if (NEON_MANAGED.test(key)) {
    skipped.push([key, 'Neon-managed (set by the Vercel integration)']);
    continue;
  }
  const reason = placeholderReason(value);
  if (reason) {
    skipped.push([key, reason]);
    continue;
  }
  toPush.push([key, value]);
}

console.log(`\nTarget environment(s): ${environments.join(', ')}`);
console.log(`Pushing ${toPush.length} var(s), skipping ${skipped.length}.\n`);

if (skipped.length) {
  console.log('Skipped:');
  for (const [key, reason] of skipped) console.log(`  - ${key.padEnd(48)} ${reason}`);
  console.log('');
}

if (dryRun) {
  console.log('Would push (--dry-run, nothing sent):');
  for (const [key] of toPush) {
    for (const env of environments) console.log(`  + ${key.padEnd(48)} → ${env}`);
  }
  console.log('\nRe-run without --dry-run to apply.');
  process.exit(0);
}

type Outcome = 'added' | 'updated' | 'exists' | 'failed';

function setVar(key: string, value: string, env: string): Outcome {
  const add = () => spawnSync('vercel', ['env', 'add', key, env], { input: value, encoding: 'utf8' });

  let res = add();
  if (res.status === 0) return 'added';

  const alreadyExists = /exist/i.test(`${res.stderr ?? ''}${res.stdout ?? ''}`);
  if (alreadyExists) {
    if (!force) return 'exists';
    const rm = spawnSync('vercel', ['env', 'rm', key, env, '-y'], { encoding: 'utf8' });
    if (rm.status !== 0) return 'failed';
    res = add();
    return res.status === 0 ? 'updated' : 'failed';
  }
  return 'failed';
}

const counts: Record<Outcome, number> = { added: 0, updated: 0, exists: 0, failed: 0 };
const icon: Record<Outcome, string> = { added: '✓ added  ', updated: '↻ updated', exists: '• exists ', failed: '✗ FAILED ' };

for (const [key, value] of toPush) {
  for (const env of environments) {
    const outcome = setVar(key, value, env);
    counts[outcome]++;
    console.log(`  ${icon[outcome]} ${key.padEnd(48)} (${env})`);
  }
}

console.log(
  `\nDone — added ${counts.added}, updated ${counts.updated}, already-present ${counts.exists}, failed ${counts.failed}.`,
);
if (counts.exists && !force) {
  console.log('Some vars already exist; re-run with --force to overwrite them with your local values.');
}
if (counts.failed) process.exit(1);
