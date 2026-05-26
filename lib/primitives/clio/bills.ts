import { z } from 'zod';
import { clioFetch } from '@/lib/clio/client';
import { registerPrimitive } from '../registry';

export const listBills = registerPrimitive({
  name: 'clio.listBills',
  category: 'clio',
  description:
    'List Clio bills (invoices). Filter by matter, state, and issued-date range. Useful for AR aging and revenue summaries.',
  inputSchema: z.object({
    matterId: z.number().int().optional(),
    state: z
      .enum(['draft', 'pending_approval', 'awaiting_payment', 'paid', 'voided'])
      .optional(),
    issuedAfter: z.string().describe('ISO date — bills issued on or after').optional(),
    issuedBefore: z.string().describe('ISO date — bills issued on or before').optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  handler: async ({ matterId, state, issuedAfter, issuedBefore, limit }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      fields:
        'id,number,subject,state,issued_at,due_at,balance,total,paid,client{id,name},matters{id,display_number}',
    });
    if (matterId) params.set('matter_id', String(matterId));
    if (state) params.set('state', state);
    if (issuedAfter) params.set('issued_at[gte]', issuedAfter);
    if (issuedBefore) params.set('issued_at[lte]', issuedBefore);

    const res = await clioFetch(`/api/v4/bills.json?${params}`);
    if (!res.ok) throw new Error(`Clio listBills failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: unknown[]; meta?: { records?: number } };
    return { bills: json.data, totalRecords: json.meta?.records };
  },
});
