# Slack Legal OS — Setup Guide

This guide takes you from a fresh clone to a working AI legal assistant running in **your own** Slack workspace, connected to **your own** Clio account.

**What you'll end up with:** a Slack bot you can `@mention` (or DM, or trigger with `/legal-os`) that looks up Clio matters/contacts/bills, renders charts inline, and answers questions with web search — plus a private admin web UI.

> ⏱️ **Time:** ~45–60 minutes the first time.
> 💳 **Cost:** Can be done on free tiers to start. A Vercel **Pro** plan is recommended (and required later for Sandbox + Cron features on the roadmap).

---

## 0. Accounts you'll need

Create these first (all have free tiers to start). Keep a scratch doc open to paste keys into as you go.

| Service | What it's for | Sign up |
|---|---|---|
| **GitHub** | Host your fork of the code | https://github.com |
| **Vercel** | Hosting + database/blob marketplace + AI Gateway | https://vercel.com/signup |
| **Neon** | Postgres database (installed *through* Vercel) | provisioned in Step 3 |
| **Clerk** | Admin-UI login | https://dashboard.clerk.com |
| **Slack** | The workspace where the bot lives (you need admin rights to install apps) | your own workspace |
| **Clio** | The case-management system the bot reads/writes | https://app.clio.com (+ developer access) |
| **Perplexity** | Web-search tool for the agent | https://www.perplexity.ai |

**Local tools:** [Node.js 24+](https://nodejs.org), [pnpm](https://pnpm.io/installation) (`npm i -g pnpm`), [git](https://git-scm.com), and the [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`).

---

## 1. Get the code

```bash
git clone https://github.com/YASAM1/slack-legal-os.git
cd slack-legal-os
pnpm install
cp .env.example .env.local
```

You'll fill in `.env.local` as you collect keys below. Every variable is documented inline in `.env.example`.

---

## 2. Create the Vercel project (do this early — it gives you your URL)

Several services (Slack, Clio) need to know your app's public URL, so create the Vercel project **first**.

```bash
vercel login
vercel link        # choose "create a new project", name it e.g. slack-legal-os
```

Your production URL will be **`https://<project-name>.vercel.app`** (Vercel shows it after linking). Write it down — this guide calls it **`YOUR-APP-URL`**.

> 📝 You can also create the project from the Vercel dashboard by importing your GitHub repo. Either way, note the production URL.

---

## 3. Provision the database (Neon, via Vercel)

1. In the Vercel dashboard, open your project → **Storage** → **Create Database** → **Neon** (Postgres) → follow the prompts.
2. This auto-injects `DATABASE_URL` **and** `DATABASE_URL_UNPOOLED` into your Vercel project's environment variables.

> ℹ️ `DATABASE_URL` is the pooled connection (used at runtime). `DATABASE_URL_UNPOOLED` is the direct connection used to run migrations. The Neon integration gives you both.
>
> 💡 No Blob store needed — charts are rendered by [QuickChart](https://quickchart.io) (a hosted Chart.js renderer) and posted to Slack as a URL, so there's nothing to store.

---

## 4. Set up Clerk (admin login)

1. Go to https://dashboard.clerk.com → **Create application**. Enable **Email** (and Google if you like) as a sign-in method.
2. From **API Keys**, copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_`)
   - `CLERK_SECRET_KEY` (starts with `sk_`)
3. Paste both into `.env.local`.
4. Set **your own email** as the admin allowlist in `.env.local`:
   ```
   ADMIN_ALLOWED_EMAILS=you@yourfirm.com
   ```
   (Comma-separate multiple admins.) Anyone signing in whose email isn't on this list gets a 403.

> The app ships its own sign-in/sign-up pages at `/sign-in` and `/sign-up` — no extra Clerk config needed; the default `.env` values already point at them.

---

## 5. Generate the encryption key

The Clio refresh token is encrypted at rest (AES-256-GCM). Generate a 32-byte key:

```bash
openssl rand -hex 32
```

Paste the 64-character result into `.env.local`:

```
ENCRYPTION_KEY=<paste the 64 hex chars here>
```

---

## 6. Get an AI Gateway key (the agent's brain)

The agent talks to Claude through the **Vercel AI Gateway**.

1. Vercel dashboard → **AI Gateway** → create an **API key**.
2. Put it in `.env.local`:
   ```
   AI_GATEWAY_API_KEY=<your key>
   ```

> ✅ **On Vercel (production), you can leave this blank** — the deployment authenticates to the Gateway automatically via OIDC. You only *need* a key for **local development**.

The default models are already set in `.env.example`:
```
AGENT_MODEL=anthropic/claude-sonnet-4.6
EMBEDDING_MODEL=openai/text-embedding-3-small   # used by the roadmap KB feature
```

---

## 7. Get a Perplexity API key (web search)

1. https://www.perplexity.ai → Settings → **API** → generate a key.
2. Add to `.env.local`:
   ```
   PERPLEXITY_API_KEY=<your key>
   ```

---

## 8. Create the Slack app

> 🔗 **Read this first — the Request URL is a two-phase thing (this is the #1 spot people get stuck).**
> Slack verifies your **Request URL** by sending it a live request, so the URL must already be **deployed and responding** — but you don't deploy until **Step 11**. There's also a chicken-and-egg: creating the app here is what *gives* you the **Signing Secret**, yet the URL won't verify until that secret is in Vercel (**Step 10**) and the app is live (**Step 11**).
>
> So in **this** step you only **create the app and copy its two credentials**. Slack's Request URL verification **will fail right now — that is expected and fine.** You'll come back and complete verification at the end of Step 11, once the app is deployed.

The repo includes an importable manifest at **`slack-manifest.json`**.

1. **Swap in your URL.** Open `slack-manifest.json` and replace every `https://YOUR-APP.vercel.app/api/webhooks/slack` with `https://YOUR-APP-URL/api/webhooks/slack`. (One endpoint handles events, the slash command, *and* interactivity.)
2. Go to https://api.slack.com/apps → **Create New App** → **From an app manifest** → pick your workspace → paste the edited JSON. **Slack will immediately attempt to verify the Request URL and show a red error — ignore it for now** (nothing is deployed yet).
3. **Install to Workspace** (under *Install App*). Approve the requested scopes.
4. Copy the **Bot User OAuth Token** (`xoxb-…`) → `.env.local` as `SLACK_BOT_TOKEN`.
5. Under **Basic Information → App Credentials**, copy the **Signing Secret** → `.env.local` as `SLACK_SIGNING_SECRET`.

The manifest already requests the right scopes (`app_mentions:read`, `chat:write`, `commands`, `files:write`, `im:history`, `users:read`, etc.) and subscribes to the right events.

> ✅ **Done here for now.** You have the two Slack credentials in `.env.local`. Leave the failed Request URL as-is — Steps 10–11 push these secrets to Vercel and deploy your app, and the end of **Step 11 walks you back here to finish verification** (it'll succeed then).

---

## 9. Create the Clio developer app

1. Log in to Clio → **Settings** → **Developers** (or visit your region's developer portal) → **New Application**.
2. Set the **Redirect URI** to exactly:
   ```
   https://YOUR-APP-URL/api/clio/auth/callback
   ```
3. Request the scopes your firm needs (read/write to matters, contacts, activities, bills, users).
4. Copy the **Client ID** and **Client Secret** → `.env.local`:
   ```
   CLIO_CLIENT_ID=<...>
   CLIO_CLIENT_SECRET=<...>
   CLIO_REDIRECT_URI=https://YOUR-APP-URL/api/clio/auth/callback
   CLIO_BASE_URL=https://app.clio.com        # use https://eu.app.clio.com if your firm is on Clio EU
   ```

---

## 10. Push all env vars to Vercel

Your keys are in `.env.local`. The fastest way to get them into Vercel:

```bash
# Add each variable to Production (and Preview/Development as desired).
# Easiest path: open the Vercel dashboard → Project → Settings → Environment Variables
# and paste each key/value. DATABASE_URL* are already there from Step 3 (Neon).
```

Make sure these exist in Vercel **Production** env:

`ENCRYPTION_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ADMIN_ALLOWED_EMAILS`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `CLIO_CLIENT_ID`, `CLIO_CLIENT_SECRET`, `CLIO_REDIRECT_URI`, `CLIO_BASE_URL`, `PERPLEXITY_API_KEY`.

(`AI_GATEWAY_API_KEY` is optional in production thanks to OIDC. `CRON_SECRET`, `VERCEL_OIDC_TOKEN` are for roadmap features — skip for now.)

> 🔑 **These two must be in Vercel Production *before* you deploy, or Slack URL verification will keep failing even on a live URL:** `SLACK_SIGNING_SECRET` (the webhook validates Slack's signed verification request against it) and `SLACK_BOT_TOKEN`. They're the credentials you copied in Step 8.

> 💡 Already added them in the dashboard? Pull them back to your machine for local dev with `vercel env pull .env.local`.

---

## 11. Deploy

Standard Vercel deploy — pick whichever you prefer:

**Option A — Git-connected (recommended).** If you imported the GitHub repo when creating the project (Step 2), every push to `main` auto-deploys. Just push, or hit **Redeploy** in the dashboard.

**Option B — CLI.**
```bash
vercel --prod
```

> 🚀 **One-click option:** the README has a **Deploy with Vercel** button that forks the repo, creates the project, and prompts for env vars in one flow. You'll still come back to this guide for the database migration (Step 12) and the Slack/Clio setup, since those need your live URL.

After it deploys, visit `https://YOUR-APP-URL` — you should get the app. Visit `https://YOUR-APP-URL/admin` and you'll be asked to sign in via Clerk; sign in with an allowlisted email.

### 11a. Finish the Slack Request URL verification (the Step 8 cliffhanger)

Your URL is now live **and** the Slack signing secret is in Vercel (Step 10), so verification will finally succeed. In https://api.slack.com/apps → your app:

1. **Event Subscriptions** → the Request URL should re-verify automatically; if it still shows the old error, click **Retry**, or re-paste `https://YOUR-APP-URL/api/webhooks/slack` and save. You want a green **Verified ✓**.
2. **Slash Commands** (`/legal-os`) and **Interactivity & Shortcuts** use the same URL — confirm both point at `https://YOUR-APP-URL/api/webhooks/slack`.
3. If Slack prompts you to **reinstall the app** after a change, do it.

> 🧪 **How to tell the endpoint is healthy** (from your terminal): an unsigned `POST` to `https://YOUR-APP-URL/api/webhooks/slack` should return **HTTP 401** (it's correctly enforcing the signing secret), and a `GET` should return **405**. A **500** means a missing/incorrect env var (most often `SLACK_SIGNING_SECRET`); a **404** means the URL is wrong.

---

## 12. Run database migrations

This enables the `pgvector` extension and creates all tables in a dedicated `legal_os` Postgres schema. Run it once against your Neon DB (it reads `DATABASE_URL_UNPOOLED` from `.env.local`):

```bash
vercel env pull .env.local     # if you haven't already, get the DB URLs locally
pnpm db:migrate
```

You should see:
```
Enabling pgvector extension...
Running migrations...
Migrations complete.
```

(Optional) inspect the DB with `pnpm db:studio`.

---

## 13. Connect Clio

1. Open `https://YOUR-APP-URL/admin/integrations`.
2. Click **Connect Clio** → you'll be sent to Clio to authorize → on success you're redirected back showing **Connected**.
3. Behind the scenes, the refresh token is encrypted and stored; the client auto-refreshes access tokens and retries on 401.

---

## 14. Invite the bot and test it

1. In Slack, invite the bot to a channel: `/invite @Legal OS` (or whatever you named it).
2. Try these:
   - `@Legal OS hello` → it replies in-thread.
   - `@Legal OS list the matters opened this month` → it calls Clio.
   - `@Legal OS show me matters opened this month as a bar chart by practice area` → it renders a chart and posts the image inline. 🎉
   - `/legal-os what's a recent ruling on <topic>?` → it uses web search and cites sources.
3. Any Clio **write** (create/update) will ask you to confirm in-thread before proceeding.

**That's a working install.** ✅

---

## Local development (optional)

```bash
vercel env pull .env.local   # sync env from Vercel
pnpm dev                     # http://localhost:3000
```

For Slack to reach your local machine, point the Slack app's Request URL at a tunnel (e.g. `ngrok http 3000` → use the https URL + `/api/webhooks/slack`). Remember to switch it back to your Vercel URL afterward.

---

## Environment variable reference

| Variable | Required now? | Where it comes from |
|---|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | ✅ | Neon integration (Step 3) |
| `ENCRYPTION_KEY` | ✅ | `openssl rand -hex 32` (Step 5) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | ✅ | Clerk (Step 4) |
| `ADMIN_ALLOWED_EMAILS` | ✅ | you choose (Step 4) |
| `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` | ✅ | Slack app (Step 8) |
| `CLIO_CLIENT_ID` / `CLIO_CLIENT_SECRET` / `CLIO_REDIRECT_URI` / `CLIO_BASE_URL` | ✅ | Clio app (Step 9) |
| `PERPLEXITY_API_KEY` | ✅ | Perplexity (Step 7) |
| `AI_GATEWAY_API_KEY` | local only | Vercel AI Gateway (Step 6) — auto via OIDC in prod |
| `AGENT_MODEL` / `EMBEDDING_MODEL` / `CODEGEN_MODEL` | defaults set | `.env.example` |
| `CRON_SECRET` / `VERCEL_OIDC_TOKEN` | roadmap | Vercel (future Cron/Sandbox features) |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Slack "Your URL didn't respond / verification failed"** | Two requirements that must *both* be true: (1) the app is **deployed and live** (Step 11), and (2) `SLACK_SIGNING_SECRET` + `SLACK_BOT_TOKEN` are in Vercel **Production** (Step 10) — then **Retry** in Event Subscriptions. Confirm the URL is exactly `https://YOUR-APP-URL/api/webhooks/slack`. A live endpoint returns 401 to an unsigned `POST` (healthy); a 500 means a missing env var. |
| **Bot doesn't reply** | Check `SLACK_SIGNING_SECRET` and `SLACK_BOT_TOKEN` are set in Vercel Production; confirm the bot was invited to the channel; check the function logs in Vercel. |
| **403 Forbidden on `/admin`** | Your Clerk email isn't in `ADMIN_ALLOWED_EMAILS`. Add it (in Vercel env) and redeploy. |
| **`ENCRYPTION_KEY must be 32 bytes`** | The key must be 64 hex chars. Regenerate with `openssl rand -hex 32`. |
| **Clio connect fails / redirect mismatch** | The Clio app's Redirect URI must match `CLIO_REDIRECT_URI` exactly, including `https://` and no trailing slash. EU firms: set `CLIO_BASE_URL=https://eu.app.clio.com`. |
| **Migrations can't connect** | Ensure `DATABASE_URL_UNPOOLED` is present locally (`vercel env pull .env.local`). |
| **Charts don't render inline** | Charts are QuickChart PNG URLs posted by the bot; Slack unfurls them. Confirm the bot can post to the channel (it's invited) and that the message isn't being blocked by link-unfurl settings. |

---

## What's on the roadmap (not yet functional)

The admin UI has placeholder pages for these; the features are in progress:

- **Knowledge base** — curated Markdown docs + ingested Clio documents embedded into pgvector for cited retrieval.
- **Capability codegen** — describe a task in plain English → preview generated code → dry-run in Vercel Sandbox → activate.
- **Scheduling & daily report** — cron-driven capabilities and an automatic daily status report to a channel.
- **Guardrails & polish** — token spend caps, run-history viewers, alerting, tests.

You don't need `CRON_SECRET` or `VERCEL_OIDC_TOKEN`/Sandbox configured to use everything in this guide.
