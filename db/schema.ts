import {
  pgSchema,
  text,
  timestamp,
  jsonb,
  uuid,
  integer,
  vector,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// All Legal OS tables live in a dedicated `legal_os` Postgres schema so the
// Neon DB can be safely shared with other projects without name conflicts.
export const legalOs = pgSchema('legal_os');

export const capabilityStatus = legalOs.enum('capability_status', [
  'draft',
  'tested',
  'active',
  'disabled',
]);

export const runStatus = legalOs.enum('run_status', ['running', 'succeeded', 'failed']);

export const runTrigger = legalOs.enum('run_trigger', ['agent', 'cron', 'dry_run', 'manual']);

export const kbSource = legalOs.enum('kb_source', ['curated', 'clio', 'web']);

export const capabilities = legalOs.table('capabilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  nlSpec: text('nl_spec').notNull(),
  generatedCode: text('generated_code').notNull(),
  primitiveToolsUsed: jsonb('primitive_tools_used').$type<string[]>().notNull().default([]),
  status: capabilityStatus('status').notNull().default('draft'),
  schedule: text('schedule'),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const capabilityRuns = legalOs.table(
  'capability_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    capabilityId: uuid('capability_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'cascade' }),
    trigger: runTrigger('trigger').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>(),
    output: jsonb('output').$type<Record<string, unknown>>(),
    status: runStatus('status').notNull().default('running'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    slackUserId: text('slack_user_id'),
  },
  (t) => [index('capability_runs_capability_idx').on(t.capabilityId, t.startedAt)],
);

export const kbDocuments = legalOs.table(
  'kb_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: kbSource('source').notNull(),
    externalId: text('external_id'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('kb_documents_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('kb_documents_source_external_idx').on(t.source, t.externalId),
  ],
);

export const agentConfig = legalOs.table('agent_config', {
  id: text('id').primaryKey().default('singleton'),
  systemPrompt: text('system_prompt').notNull(),
  model: text('model').notNull().default('anthropic/claude-sonnet-4.6'),
  temperature: integer('temperature').notNull().default(0),
  defaultReportChannel: text('default_report_channel'),
  allowedWebDomains: jsonb('allowed_web_domains').$type<string[]>().notNull().default([]),
  dailyTokenBudget: integer('daily_token_budget'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type StoredMessage = { role: 'user' | 'assistant'; content: string };

export const conversations = legalOs.table(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slackChannel: text('slack_channel').notNull(),
    slackThreadTs: text('slack_thread_ts').notNull(),
    messages: jsonb('messages').$type<StoredMessage[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('conversations_thread_uniq').on(t.slackChannel, t.slackThreadTs)],
);

export const auditLog = legalOs.table(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorSlackUserId: text('actor_slack_user_id'),
    actorName: text('actor_name'),
    action: text('action').notNull(),
    resource: text('resource'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_timestamp_idx').on(t.timestamp),
    index('audit_log_actor_idx').on(t.actorSlackUserId),
  ],
);

export const clioOauth = legalOs.table('clio_oauth', {
  id: text('id').primaryKey().default('singleton'),
  encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
  lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const confirmationStatus = legalOs.enum('confirmation_status', [
  'pending',
  'approved',
  'denied',
  'timeout',
]);

export const confirmationRequests = legalOs.table(
  'confirmation_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    toolName: text('tool_name').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    status: confirmationStatus('status').notNull().default('pending'),
    slackChannel: text('slack_channel'),
    slackThreadTs: text('slack_thread_ts'),
    slackMessageTs: text('slack_message_ts'),
    decidedBy: text('decided_by'),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [index('confirmation_requests_status_idx').on(t.status, t.postedAt)],
);

export const enableVectorExtension = sql`CREATE EXTENSION IF NOT EXISTS vector`;
