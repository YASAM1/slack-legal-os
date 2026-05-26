import { z } from 'zod';
import { clioFetch } from '@/lib/clio/client';
import { registerPrimitive } from '../registry';

export const listActivities = registerPrimitive({
  name: 'clio.listActivities',
  category: 'clio',
  description:
    'List Clio activities (time entries and expenses). Filter by matter, user, and date range.',
  inputSchema: z.object({
    matterId: z.number().int().optional(),
    userId: z.number().int().optional().describe('Clio user ID of the person who logged it'),
    startDate: z.string().describe('ISO date — activities on or after').optional(),
    endDate: z.string().describe('ISO date — activities on or before').optional(),
    type: z.enum(['TimeEntry', 'ExpenseEntry']).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  handler: async ({ matterId, userId, startDate, endDate, type, limit }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      fields:
        'id,type,date,quantity,price,total,non_billable,note,user{id,name},matter{id,display_number}',
    });
    if (matterId) params.set('matter_id', String(matterId));
    if (userId) params.set('user_id', String(userId));
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    if (type) params.set('type', type);

    const res = await clioFetch(`/api/v4/activities.json?${params}`);
    if (!res.ok) throw new Error(`Clio listActivities failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: unknown[]; meta?: { records?: number } };
    return { activities: json.data, totalRecords: json.meta?.records };
  },
});
