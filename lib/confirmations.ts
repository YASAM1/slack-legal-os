import { eq } from 'drizzle-orm';
import type { SlackAdapter } from '@chat-adapter/slack';
import { db, schema } from '@/db/client';
import { getBot } from '@/lib/bot';

const POLL_INTERVAL_MS = 1500;
const TIMEOUT_MS = 60_000;

export interface ConfirmRequest {
  toolName: string;
  input: unknown;
  channel: string;
  threadTs?: string;
}

/**
 * Post Yes/No buttons in the requested thread, then poll the DB until the
 * user clicks (or 60s elapses). Returns true if approved, false otherwise.
 *
 * Pending rows are written to `legal_os.confirmation_requests`; the
 * `bot.onAction` handler in lib/bot.ts updates them when the buttons are
 * clicked. Action IDs encode the row UUID: `legalos_confirm:<uuid>:yes|no`.
 */
export async function requestConfirmation(req: ConfirmRequest): Promise<boolean> {
  const [row] = await db
    .insert(schema.confirmationRequests)
    .values({
      toolName: req.toolName,
      input: req.input as Record<string, unknown>,
      slackChannel: req.channel,
      slackThreadTs: req.threadTs,
    })
    .returning({ id: schema.confirmationRequests.id });

  const slack = getBot().getAdapter('slack') as SlackAdapter;
  const posted = await slack.webClient.chat.postMessage({
    channel: req.channel,
    thread_ts: req.threadTs,
    text: `Confirm: run \`${req.toolName}\`?`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Confirm action:* \`${req.toolName}\`\n\`\`\`${JSON.stringify(req.input, null, 2).slice(0, 1500)}\`\`\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Yes, run it' },
            style: 'primary',
            action_id: `legalos_confirm:${row.id}:yes`,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'No, cancel' },
            style: 'danger',
            action_id: `legalos_confirm:${row.id}:no`,
          },
        ],
      },
    ],
  });

  if (posted.ts) {
    await db
      .update(schema.confirmationRequests)
      .set({ slackMessageTs: posted.ts })
      .where(eq(schema.confirmationRequests.id, row.id));
  }

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const [latest] = await db
      .select({ status: schema.confirmationRequests.status })
      .from(schema.confirmationRequests)
      .where(eq(schema.confirmationRequests.id, row.id))
      .limit(1);
    if (latest?.status === 'approved') return true;
    if (latest?.status === 'denied') return false;
  }

  // Mark as timeout so a late click is rejected.
  await db
    .update(schema.confirmationRequests)
    .set({ status: 'timeout', decidedAt: new Date() })
    .where(eq(schema.confirmationRequests.id, row.id));
  return false;
}

/** Called by bot.onAction when a confirmation button is clicked. */
export async function recordConfirmationDecision(
  requestId: string,
  decision: 'approved' | 'denied',
  slackUserId: string,
): Promise<boolean> {
  const updated = await db
    .update(schema.confirmationRequests)
    .set({ status: decision, decidedBy: slackUserId, decidedAt: new Date() })
    .where(eq(schema.confirmationRequests.id, requestId))
    .returning({ id: schema.confirmationRequests.id, status: schema.confirmationRequests.status });
  return updated.length > 0 && updated[0].status === decision;
}
