import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <main className="mx-auto max-w-xl space-y-6 px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Slack Legal OS</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Slack-native AI agent for a law firm&apos;s case management. Talk to the bot in Slack;
          manage capabilities and the knowledge base from the admin console.
        </p>
        <Link
          href="/admin"
          className="inline-flex h-10 items-center justify-center rounded-md bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Open admin console
        </Link>
      </main>
    </div>
  );
}
