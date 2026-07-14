import { z } from 'zod';

/**
 * POST /api/chat request validation (spec section 8/11). Only user/assistant turns are accepted
 * from the client — a `system` role would let a client inject its own system prompt, so it's
 * rejected by the enum rather than merely ignored.
 */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(20),
  page: z.string().max(200).optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
