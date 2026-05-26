import { z } from 'zod';
import { clioFetch } from '@/lib/clio/client';
import { registerPrimitive } from '../registry';

export const listUsers = registerPrimitive({
  name: 'clio.listUsers',
  category: 'clio',
  description:
    'List all users (attorneys and staff) in the Clio firm. Returns id, name, email, role.',
  inputSchema: z.object({}),
  handler: async () => {
    const params = new URLSearchParams({
      fields: 'id,name,email,enabled,roles',
      limit: '200',
    });
    const res = await clioFetch(`/api/v4/users.json?${params}`);
    if (!res.ok) throw new Error(`Clio listUsers failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: unknown[]; meta?: { records?: number } };
    return { users: json.data, totalRecords: json.meta?.records };
  },
});
