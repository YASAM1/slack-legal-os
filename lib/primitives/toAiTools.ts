import { tool, type ToolSet } from 'ai';
import { db, schema } from '@/db/client';
import { listPrimitives } from './registry';
import { toAiName, type PrimitiveContext, type PrimitiveTool } from './types';

interface ToolBuildOptions {
  ctx: PrimitiveContext;
  /** Hook for write-action confirmation. Return false to abort the tool call. */
  confirm?: (tool: PrimitiveTool, input: unknown) => Promise<boolean>;
  /** Optional filter — return false to omit a primitive from the agent's tool list. */
  filter?: (tool: PrimitiveTool) => boolean;
}

export function buildAiTools(opts: ToolBuildOptions): ToolSet {
  const entries = listPrimitives()
    .filter((p) => (opts.filter ? opts.filter(p) : true))
    .map((p) => {
      const aiName = p.aiName ?? toAiName(p.name);
      return [
        aiName,
        tool({
          description: p.description,
          inputSchema: p.inputSchema,
          execute: async (input: unknown) => {
            const startedAt = new Date();

            if (p.requiresConfirmation && opts.confirm) {
              const ok = await opts.confirm(p, input);
              if (!ok) {
                await writeAudit(p, opts.ctx, input, null, 'declined', startedAt);
                return { declined: true, reason: 'User declined to confirm the action.' };
              }
            }

            try {
              const result = await p.handler(input as never, opts.ctx);
              await writeAudit(p, opts.ctx, input, result, 'ok', startedAt);
              return result;
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              await writeAudit(p, opts.ctx, input, { error: message }, 'error', startedAt);
              throw e;
            }
          },
        }),
      ] as const;
    });
  return Object.fromEntries(entries);
}

async function writeAudit(
  p: PrimitiveTool,
  ctx: PrimitiveContext,
  input: unknown,
  output: unknown,
  outcome: 'ok' | 'error' | 'declined',
  startedAt: Date,
): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      actorSlackUserId: ctx.slackUserId,
      actorName: ctx.slackUserName,
      action: p.name,
      resource: ctx.slackChannel
        ? `slack:${ctx.slackChannel}${ctx.slackThreadTs ? `:${ctx.slackThreadTs}` : ''}`
        : null,
      payload: {
        input,
        output,
        outcome,
        durationMs: Date.now() - startedAt.getTime(),
      },
    });
  } catch {
    // Audit logging must never break a tool call. Swallow.
  }
}
