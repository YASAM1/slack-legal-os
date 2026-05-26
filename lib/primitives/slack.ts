import { z } from 'zod';
import type { SlackAdapter } from '@chat-adapter/slack';
import { registerPrimitive } from './registry';
import { getBot } from '@/lib/bot';

function getSlack(): SlackAdapter {
  return getBot().getAdapter('slack') as SlackAdapter;
}

export const slackPostImage = registerPrimitive({
  name: 'slack.postImage',
  category: 'slack',
  description:
    'Post a publicly-accessible image URL into a Slack channel/thread as an inline image (Block Kit image block). Use this for chart URLs returned from chart.* tools — it renders the image inline, no upload needed. Pass channel + threadTs from your current conversation context.',
  inputSchema: z.object({
    channel: z.string(),
    threadTs: z.string().optional(),
    imageUrl: z.string().url(),
    altText: z.string().describe('Brief description of the image for accessibility').default('chart'),
    title: z.string().optional().describe('Optional caption shown above the image'),
  }),
  handler: async ({ channel, threadTs, imageUrl, altText, title }) => {
    const blocks: Array<Record<string, unknown>> = [];
    if (title) {
      blocks.push({
        type: 'header',
        text: { type: 'plain_text', text: title, emoji: true },
      });
    }
    blocks.push({
      type: 'image',
      image_url: imageUrl,
      alt_text: altText,
    });
    const res = await getSlack().webClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: title ?? altText,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: blocks as any,
    });
    return { ok: res.ok, ts: res.ts };
  },
});

export const slackPost = registerPrimitive({
  name: 'slack.post',
  category: 'slack',
  description:
    'Post a plain or richly-formatted message into a Slack channel or thread. Use Block Kit `blocks` for rich content; plain `text` is also shown as fallback.',
  inputSchema: z.object({
    channel: z.string().describe('Slack channel ID (e.g. C0123ABCD)'),
    text: z.string().describe('Plain text fallback / preview text'),
    threadTs: z.string().optional(),
    blocks: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
  handler: async ({ channel, text, threadTs, blocks }) => {
    const res = await getSlack().webClient.chat.postMessage({
      channel,
      text,
      thread_ts: threadTs,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: blocks as any,
    });
    return { ok: res.ok, ts: res.ts, channel: res.channel };
  },
});

export const slackUploadFile = registerPrimitive({
  name: 'slack.uploadFile',
  category: 'slack',
  description:
    'Upload an image or file to Slack from a public URL (e.g. a chart.* output). Posts it into a channel or thread.',
  inputSchema: z.object({
    channel: z.string(),
    url: z.string().url().describe('Public URL of the file to upload'),
    title: z.string(),
    filename: z.string().optional(),
    threadTs: z.string().optional(),
    initialComment: z.string().optional(),
  }),
  handler: async ({ channel, url, title, filename, threadTs, initialComment }) => {
    const fetchRes = await fetch(url);
    if (!fetchRes.ok) throw new Error(`Could not fetch ${url}: ${fetchRes.status}`);
    const bytes = Buffer.from(await fetchRes.arrayBuffer());
    const args: Record<string, unknown> = {
      channel_id: channel,
      file: bytes,
      filename: filename ?? `${title.replace(/\s+/g, '_')}.png`,
      title,
    };
    if (threadTs) args.thread_ts = threadTs;
    if (initialComment) args.initial_comment = initialComment;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await getSlack().webClient.files.uploadV2(args as any);
    return { ok: res.ok };
  },
});

export const slackConfirm = registerPrimitive({
  name: 'slack.confirm',
  category: 'slack',
  description:
    'Post a confirmation prompt with Yes/No buttons in a thread. Note: in the current build the call returns immediately after posting (does not block). A future phase will add durable wait-for-click via Vercel Workflow.',
  inputSchema: z.object({
    channel: z.string(),
    threadTs: z.string().optional(),
    question: z.string(),
    confirmLabel: z.string().default('Yes'),
    cancelLabel: z.string().default('No'),
    actionId: z
      .string()
      .describe('Stable id you can match on later in an interactivity handler')
      .default('confirm'),
  }),
  handler: async ({ channel, threadTs, question, confirmLabel, cancelLabel, actionId }) => {
    const res = await getSlack().webClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: question,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: question },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: confirmLabel },
              style: 'primary',
              action_id: `${actionId}:yes`,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: cancelLabel },
              action_id: `${actionId}:no`,
            },
          ],
        },
      ],
    });
    return { ok: res.ok, ts: res.ts, blocking: false };
  },
});
