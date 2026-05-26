import { z } from 'zod';

export interface PrimitiveContext {
  slackUserId?: string;
  slackUserName?: string;
  slackChannel?: string;
  slackThreadTs?: string;
}

export type PrimitiveCategory = 'clio' | 'chart' | 'web' | 'slack' | 'kb';

export interface PrimitiveTool<TInput extends z.ZodType = z.ZodType> {
  /** Dotted display name (e.g. `clio.listMatters`). Used in logs and prompts. */
  name: string;
  /** Underscored form for the LLM tool surface (`clio_listMatters`). Auto-derived if omitted. */
  aiName?: string;
  category: PrimitiveCategory;
  description: string;
  inputSchema: TInput;
  /** When true, the agent loop prompts the user in Slack to confirm before invoking. */
  requiresConfirmation?: boolean;
  handler: (input: z.infer<TInput>, ctx: PrimitiveContext) => Promise<unknown>;
}

/** Helper that preserves schema → handler input inference when defining a primitive. */
export function definePrimitive<TInput extends z.ZodType>(
  tool: PrimitiveTool<TInput>,
): PrimitiveTool<TInput> {
  return tool;
}

export function toAiName(dotted: string): string {
  return dotted.replace(/\./g, '_');
}
