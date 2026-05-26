import Link from 'next/link';
import { isClioConnected } from '@/lib/clio/client';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ clio_connected?: string; clio_error?: string }>;
}) {
  const params = await searchParams;
  let connected = false;
  let dbError: string | null = null;
  try {
    connected = await isClioConnected();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Integrations</h1>

      {params.clio_connected && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          Clio connected successfully.
        </div>
      )}
      {params.clio_error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
          Clio connection failed: {params.clio_error}
        </div>
      )}

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Clio</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Matters, contacts, activities, bills, and documents.
            </p>
            <p className="mt-2 text-sm">
              Status:{' '}
              {dbError ? (
                <span className="font-medium text-rose-600">error — {dbError}</span>
              ) : connected ? (
                <span className="font-medium text-emerald-600">Connected</span>
              ) : (
                <span className="font-medium text-neutral-500">Not connected</span>
              )}
            </p>
          </div>
          <Link
            href="/api/clio/auth/start"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {connected ? 'Reconnect' : 'Connect Clio'}
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-medium">Slack</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Connected via Slack app credentials in env (Bot Token + Signing Secret). Webhook:
          <code className="ml-1 rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-800">
            /api/webhooks/slack
          </code>
        </p>
      </section>
    </div>
  );
}
