import { unwrapItems, type PaginatedResult } from './api';

export type SupportTicket = {
  id: string;
  userId: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  relatedTransactionId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportMessage = {
  id: string;
  body: string;
  isStaff: boolean;
  authorUserId: string;
  createdAt: string;
};

export type SupportTicketDetail = {
  ticket: SupportTicket;
  customer: { phone: string; tag?: string | null } | null;
  messages: SupportMessage[];
};

type AuthFetch = <T>(
  path: string,
  init?: { method?: string; body?: unknown },
) => Promise<T>;

export async function listMyTickets(authFetch: AuthFetch) {
  const body = await authFetch<
    SupportTicket[] | PaginatedResult<SupportTicket>
  >('/v1/support/tickets?limit=50');
  return unwrapItems(body);
}

export async function getTicket(authFetch: AuthFetch, id: string) {
  return authFetch<SupportTicketDetail>(`/v1/support/tickets/${id}`);
}

export async function createTicket(
  authFetch: AuthFetch,
  input: {
    subject: string;
    body: string;
    category?: string;
    relatedTransactionId?: string;
  },
) {
  return authFetch<SupportTicketDetail>('/v1/support/tickets', {
    method: 'POST',
    body: input,
  });
}

export async function replyTicket(
  authFetch: AuthFetch,
  id: string,
  body: string,
) {
  return authFetch<SupportTicketDetail>(`/v1/support/tickets/${id}/messages`, {
    method: 'POST',
    body: { body },
  });
}

export async function reopenTicket(
  authFetch: AuthFetch,
  id: string,
  body?: string,
) {
  return authFetch<SupportTicketDetail>(`/v1/support/tickets/${id}/reopen`, {
    method: 'POST',
    body: body?.trim() ? { body: body.trim() } : {},
  });
}
