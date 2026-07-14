/**
 * Transport-agnostic MCP server factory. Both entry points (stdio.ts for local/npx use, worker.ts
 * for the Cloudflare remote deployment) call `createServer()` and connect their own transport —
 * the tool set itself, and the security shell wrapping every tool, are defined exactly once here.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RateLimiter } from '../../../src/core/ports/rate-limiter';
import { getCv, getCvToolDefinition } from './tools/get-cv.js';
import { getProfile, getProfileToolDefinition } from './tools/get-profile.js';
import { searchContent, searchContentInputSchema, searchContentToolDefinition } from './tools/search-content.js';
import { getPage, getPageInputSchema, getPageToolDefinition } from './tools/get-page.js';
import { listProjects, listProjectsToolDefinition } from './tools/list-projects.js';
import { listArticles, listArticlesToolDefinition } from './tools/list-articles.js';
import { askFelipe, askFelipeInputSchema, askFelipeToolDefinition } from './tools/ask-felipe.js';
import { leaveMessage, leaveMessageInputSchema, leaveMessageToolDefinition } from './tools/leave-message.js';
import { withSecurityShell } from './security/shell.js';
import type { ToolClass } from './security/limits.js';
import type { McpEnv } from './config.js';

const SERVER_NAME = 'felipetavares-mcp';
const SERVER_VERSION = '0.1.0';

export interface CreateServerDeps {
  rateLimiter: RateLimiter;
  env: McpEnv;
  /** Per-caller identity for rate-limit bucketing (security/identity.ts). */
  identity: string;
}

/**
 * Wraps a tool's return value into the SDK's expected shape. `structuredContent` must be a JSON
 * *object* per the MCP spec/SDK validation (a bare top-level array fails with "expected record,
 * received array") — array-shaped results (search/list tools) are wrapped under a `results` key
 * rather than each tool re-inventing its own envelope.
 */
function textResult(data: unknown) {
  const structured = Array.isArray(data) ? { results: data } : (data as Record<string, unknown>);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: structured,
  };
}

/** A shell-denied call surfaces as a normal (non-throwing) MCP tool error result — same shape a
 *  handler exception produces — never a protocol-level crash. */
function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  };
}

export function createServer(deps: CreateServerDeps): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  function guarded<Input>(
    toolName: string,
    toolClass: ToolClass,
    handler: (input: Input) => Promise<unknown>
  ) {
    return async (input: Input) => {
      const result = await withSecurityShell(
        { rateLimiter: deps.rateLimiter, env: deps.env },
        toolName,
        toolClass,
        deps.identity,
        () => handler(input)
      );
      return result.ok ? textResult(result.data) : errorResult(result.error!);
    };
  }

  server.registerTool('get_cv', getCvToolDefinition, guarded('get_cv', 'read', getCv));

  server.registerTool('get_profile', getProfileToolDefinition, guarded('get_profile', 'read', getProfile));

  server.registerTool(
    'search_content',
    { ...searchContentToolDefinition, inputSchema: searchContentInputSchema.shape },
    guarded('search_content', 'search', searchContent)
  );

  server.registerTool(
    'get_page',
    { ...getPageToolDefinition, inputSchema: getPageInputSchema.shape },
    guarded('get_page', 'read', getPage)
  );

  server.registerTool('list_projects', listProjectsToolDefinition, guarded('list_projects', 'read', listProjects));

  server.registerTool('list_articles', listArticlesToolDefinition, guarded('list_articles', 'read', listArticles));

  server.registerTool(
    'ask_felipe',
    { ...askFelipeToolDefinition, inputSchema: askFelipeInputSchema.shape },
    guarded('ask_felipe', 'ask_felipe', (input) => askFelipe(input, deps.env))
  );

  server.registerTool(
    'leave_message',
    { ...leaveMessageToolDefinition, inputSchema: leaveMessageInputSchema.shape },
    guarded('leave_message', 'leave_message', (input) => leaveMessage(input, deps.env))
  );

  return server;
}
