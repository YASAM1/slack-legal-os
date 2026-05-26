import { z } from 'zod';
import { clioFetch } from '@/lib/clio/client';
import { registerPrimitive } from '../registry';

export const listMatters = registerPrimitive({
  name: 'clio.listMatters',
  category: 'clio',
  description:
    'List Clio matters. Optional filters: status (open/pending/closed), openedAfter (ISO date), limit (max 100, default 25).',
  inputSchema: z.object({
    status: z.enum(['open', 'pending', 'closed']).optional(),
    openedAfter: z
      .string()
      .describe('ISO 8601 date or datetime, e.g. 2026-01-01')
      .optional(),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  handler: async ({ status, openedAfter, limit }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      fields: 'id,display_number,description,status,practice_area{name},client{name},open_date',
    });
    if (status) params.set('status', status);
    if (openedAfter) params.set('open_date[gte]', openedAfter);
    const res = await clioFetch(`/api/v4/matters.json?${params}`);
    if (!res.ok) throw new Error(`Clio listMatters failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: unknown[]; meta?: { records?: number } };
    return { matters: json.data, totalRecords: json.meta?.records };
  },
});

export const getMatter = registerPrimitive({
  name: 'clio.getMatter',
  category: 'clio',
  description: 'Get full details for a single Clio matter by ID.',
  inputSchema: z.object({
    id: z.number().int().describe('Clio matter ID'),
  }),
  handler: async ({ id }) => {
    const params = new URLSearchParams({
      fields:
        'id,display_number,description,status,practice_area{name},client{name,id},responsible_attorney{name},open_date,close_date,custom_field_values',
    });
    const res = await clioFetch(`/api/v4/matters/${id}.json?${params}`);
    if (!res.ok) throw new Error(`Clio getMatter failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: unknown };
    return json.data;
  },
});

export const createMatter = registerPrimitive({
  name: 'clio.createMatter',
  category: 'clio',
  description:
    'Create a new Clio matter for an existing client. Requires the client_id (look up via clio.listContacts first).',
  requiresConfirmation: true,
  inputSchema: z.object({
    clientId: z.number().int().describe('Clio contact ID for the client'),
    description: z.string().min(1).max(500),
    practiceAreaId: z.number().int().optional().describe('Optional practice area ID'),
    responsibleAttorneyId: z.number().int().optional(),
  }),
  handler: async ({ clientId, description, practiceAreaId, responsibleAttorneyId }) => {
    const body = {
      data: {
        description,
        client: { id: clientId },
        ...(practiceAreaId && { practice_area: { id: practiceAreaId } }),
        ...(responsibleAttorneyId && {
          responsible_attorney: { id: responsibleAttorneyId },
        }),
      },
    };
    const res = await clioFetch('/api/v4/matters.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Clio createMatter failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: unknown };
    return json.data;
  },
});

export const updateMatter = registerPrimitive({
  name: 'clio.updateMatter',
  category: 'clio',
  description: 'Update fields on a Clio matter. Only the provided fields are changed.',
  requiresConfirmation: true,
  inputSchema: z.object({
    id: z.number().int(),
    description: z.string().min(1).max(500).optional(),
    status: z.enum(['open', 'pending', 'closed']).optional(),
    practiceAreaId: z.number().int().optional(),
    responsibleAttorneyId: z.number().int().optional(),
  }),
  handler: async ({ id, description, status, practiceAreaId, responsibleAttorneyId }) => {
    const body: { data: Record<string, unknown> } = { data: {} };
    if (description !== undefined) body.data.description = description;
    if (status !== undefined) body.data.status = status;
    if (practiceAreaId !== undefined) body.data.practice_area = { id: practiceAreaId };
    if (responsibleAttorneyId !== undefined)
      body.data.responsible_attorney = { id: responsibleAttorneyId };

    const res = await clioFetch(`/api/v4/matters/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Clio updateMatter failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: unknown };
    return json.data;
  },
});
