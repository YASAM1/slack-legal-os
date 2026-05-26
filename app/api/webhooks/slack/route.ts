import { waitUntil } from '@vercel/functions';
import { getBot } from '@/lib/bot';

export function POST(req: Request) {
  return getBot().webhooks.slack(req, { waitUntil });
}
