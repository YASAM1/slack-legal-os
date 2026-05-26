import { z } from 'zod';
import { clioFetch } from '@/lib/clio/client';
import { registerPrimitive } from '../registry';

export const createContact = registerPrimitive({
  name: 'clio.createContact',
  category: 'clio',
  description:
    'Create a new Clio contact. For a Person, pass firstName + lastName. For a Company, pass companyName. Optional email and phone.',
  requiresConfirmation: true,
  inputSchema: z
    .object({
      type: z.enum(['Person', 'Company']),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      companyName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .refine(
      (v) =>
        (v.type === 'Person' && v.firstName && v.lastName) ||
        (v.type === 'Company' && v.companyName),
      {
        message: 'Person requires firstName + lastName; Company requires companyName',
      },
    ),
  handler: async ({ type, firstName, lastName, companyName, email, phone }) => {
    const data: Record<string, unknown> = { type };
    if (type === 'Person') {
      data.first_name = firstName;
      data.last_name = lastName;
    } else {
      data.name = companyName;
    }
    if (email) data.email_addresses = [{ name: 'Work', address: email, default_email: true }];
    if (phone) data.phone_numbers = [{ name: 'Work', number: phone, default_number: true }];

    const res = await clioFetch('/api/v4/contacts.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error(`Clio createContact failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: unknown };
    return json.data;
  },
});

export const listContacts = registerPrimitive({
  name: 'clio.listContacts',
  category: 'clio',
  description:
    'List Clio contacts (people or companies the firm has dealings with). Use search to filter by name.',
  inputSchema: z.object({
    search: z.string().optional().describe('Free-text name search'),
    type: z.enum(['Person', 'Company']).optional(),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  handler: async ({ search, type, limit }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      fields: 'id,name,first_name,last_name,type,primary_email_address,primary_phone_number',
    });
    if (search) params.set('query', search);
    if (type) params.set('type', type);
    const res = await clioFetch(`/api/v4/contacts.json?${params}`);
    if (!res.ok) throw new Error(`Clio listContacts failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: unknown[]; meta?: { records?: number } };
    return { contacts: json.data, totalRecords: json.meta?.records };
  },
});
