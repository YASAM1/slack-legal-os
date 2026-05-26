# Slack Legal OS

A Slack-native AI agent that operates a single law firm's [Clio](https://www.clio.com/) case-management system. Talk to it in Slack — by `@mention`, DM, or the `/legal-os` slash command — to look up matters, contacts, time entries, and bills, render financial charts inline, and answer questions with web search. A Clerk-protected admin web UI lets you manage the agent.

This is a **single-tenant** project: one firm, one Slack workspace, one Clio account.

> **Built on:** Next.js 16 (App Router) · React 19 · Vercel AI SDK v6 · Vercel Chat SDK (Slack) · Neon Postgres + pgvector · Drizzle ORM · Clerk · shadcn/ui · Tailwind 4

---

## What works today

This repo is functional through the agent + tools milestone:

- **Slack chat agent** — mention the bot, DM it, or use `/legal-os`. Powered by Claude via the Vercel AI Gateway, with per-thread conversation memory.
- **Clio integration** — OAuth2 connect flow; read/write primitives for matters, contacts, activities (time entries), bills, and users. Writes prompt for confirmation in-thread.
- **Charts** — ask for a chart (bar/line/pie) and the agent renders it via [QuickChart](https://quickchart.io) and posts the image inline in Slack. _(Chart data is sent to QuickChart, a third-party service.)_
- **Web search** — the agent can reach out to Perplexity for general/legal questions and cite sources.
- **Admin UI** (`/admin`) — Clerk-gated by an email allowlist; Clio connection management and an agent settings shell.
- **Audit log** — every tool call (especially Clio writes) is recorded with the originating Slack user.

## On the roadmap (not yet built)

These sections of the admin UI are placeholders and the underlying features are in progress:

- **Knowledge base** — embed curated Markdown docs + ingested Clio documents into pgvector for cited retrieval.
- **Capability codegen** — describe a task in plain English, preview generated code, dry-run it in Vercel Sandbox, then activate.
- **Scheduling / daily report** — cron-driven capabilities and an automatic daily status report.
- **Polish** — token spend caps, run-history viewers, hardening.

---

## Setup

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YASAM1/slack-legal-os&env=ENCRYPTION_KEY,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,ADMIN_ALLOWED_EMAILS,SLACK_BOT_TOKEN,SLACK_SIGNING_SECRET,CLIO_CLIENT_ID,CLIO_CLIENT_SECRET,CLIO_REDIRECT_URI,CLIO_BASE_URL,PERPLEXITY_API_KEY,AI_GATEWAY_API_KEY&envDescription=Keys%20needed%20to%20run%20Legal%20OS%20%E2%80%94%20see%20SETUP.md%20for%20how%20to%20get%20each&envLink=https://github.com/YASAM1/slack-legal-os/blob/main/SETUP.md&project-name=slack-legal-os&repository-name=slack-legal-os)

The button above forks the repo and creates a Vercel project in one flow. Standing up a **fully working** instance also needs a database, Slack app, and Clio app configured with your live URL — so follow the click-by-click walkthrough:

### 👉 [SETUP.md](./SETUP.md)

It takes you from a fresh clone to a working bot in your own Slack workspace (~45–60 min).

## Quick local start (after completing SETUP.md)

```bash
pnpm install
cp .env.example .env.local   # then fill in your values
pnpm db:migrate              # enable pgvector + apply schema
pnpm dev                     # http://localhost:3000
```

## Project layout

```
app/                 Next.js App Router (admin UI + API routes)
  admin/             Clerk-gated admin pages
  api/webhooks/slack one endpoint for Slack events, slash commands, interactivity
  api/clio/auth/     Clio OAuth start + callback
lib/
  bot.ts             Chat SDK bot + agent loop
  primitives/        the hand-built tool library (clio.*, chart.*, slack.*, web.*)
  clio/client.ts     Clio API client with auto token refresh
  crypto.ts          AES-256-GCM for the Clio refresh token at rest
db/
  schema.ts          Drizzle schema (legal_os Postgres schema)
  migrate.ts         enables pgvector, runs migrations
slack-manifest.json  importable Slack app manifest (swap in your deployment URL)
```

## License

Provided as-is for educational/demo purposes.
