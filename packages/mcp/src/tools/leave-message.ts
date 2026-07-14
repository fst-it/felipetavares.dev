/**
 * `leave_message` — the one MCP tool with a side effect (sends an email via the existing
 * EmailSender port, same as /api/contact). Inert by design: there is no reply channel back to the
 * calling agent and nothing here executes anything — the tool's entire effect is "an email lands
 * in Felipe's inbox." Every delivered message carries an explicit honesty line stating it was sent
 * by an AI agent on behalf of its user, never presented as if Felipe's site sent it unprompted or
 * as if the human contacted him directly.
 */
import { z } from 'zod';
import { getEmailSender, type McpEnv } from '../config';

const emailOrUrl = z
  .string()
  .trim()
  .min(1)
  .max(320)
  .refine((value) => z.email().safeParse(value).success || z.url().safeParse(value).success, {
    message: 'senderContact must be a valid email address or URL.',
  });

export const leaveMessageInputSchema = z
  .object({
    senderName: z.string().trim().min(1).max(120).describe("The human's name, on whose behalf the agent is writing."),
    senderContact: emailOrUrl.describe('An email address or URL (e.g. LinkedIn profile) the human can be reached at.'),
    message: z.string().trim().min(1).max(1200).describe('The message body, up to 1200 characters.'),
    context: z.string().trim().max(500).optional().describe('Optional short context for why this message is being sent.'),
  })
  .strict();

export type LeaveMessageInput = z.infer<typeof leaveMessageInputSchema>;

const CONTACT_TO_EMAIL_DEFAULT = 'contact@felipetavares.dev';
const FROM_ADDRESS = 'MCP agent <mcp@felipetavares.dev>';

export interface LeaveMessageResult {
  delivered: boolean;
}

export async function leaveMessage(input: LeaveMessageInput, env: McpEnv): Promise<LeaveMessageResult> {
  const emailSender = getEmailSender(env);
  const toEmail = env.CONTACT_TO_EMAIL || CONTACT_TO_EMAIL_DEFAULT;

  const body = [
    `From: ${input.senderName} <${input.senderContact}>`,
    input.context ? `Context: ${input.context}` : undefined,
    '',
    input.message,
    '',
    "---",
    'Sent via MCP by an AI agent on behalf of its user. This is not a message Felipe\'s site sent ' +
      'unprompted, and it was not typed directly by the person named above — an AI agent relayed it ' +
      'through the leave_message tool.',
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  await emailSender.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: `[felipetavares.dev MCP] Message from ${input.senderName} (via AI agent)`,
    body,
  });

  return { delivered: true };
}

export const leaveMessageToolDefinition = {
  title: 'Leave Message',
  description:
    'Sends a plain-text message to Felipe Tavares on behalf of a human, via email — for when an ' +
    "agent's user wants to reach out (a recruiting conversation, a speaking invitation, feedback) " +
    "but there's no other contact tool available. Inert by design: there is no reply channel back " +
    "to the calling agent, nothing is executed, and the delivered email always discloses it was " +
    "sent by an AI agent on the human's behalf — never presented as a direct message from the " +
    "human. Rate-limited (3/day per caller, 20/day globally). Requires `senderName`, a " +
    '`senderContact` (email or URL the human can be reached at), and a `message` (max 1200 chars); ' +
    '`context` is optional. Example: `{"senderName": "Jane Doe", "senderContact": ' +
    '"jane@example.com", "message": "Loved your Selfwright writeup — open to a call?"}`.',
  inputSchema: leaveMessageInputSchema.shape,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};
