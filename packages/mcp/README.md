# felipetavares-mcp

An MCP (Model Context Protocol) server exposing [felipetavares.dev](https://felipetavares.dev)'s
published content — CV, projects, articles, positioning — and a grounded "ask Felipe" chatbot to
AI agents. See [docs/mcp.md](https://github.com/fst-it/fst_website/blob/main/docs/mcp.md) in the
main repo for the full tool table, security model, and usage instructions.

## Quick start (stdio)

```bash
npx felipetavares-mcp
```

Add to an MCP client config (Claude Desktop, Claude Code, etc.):

```json
{
  "mcpServers": {
    "felipetavares": {
      "command": "npx",
      "args": ["-y", "felipetavares-mcp"]
    }
  }
}
```

No credentials required — every tool works out of the box. `ask_felipe` and `leave_message`
upgrade automatically if `ANTHROPIC_API_KEY` / `RESEND_API_KEY` are set in the environment;
otherwise they use zero-credential dev fallbacks (a grounded retrieval-based answer; a
console-logged email).

## Tools

`get_cv`, `get_profile`, `search_content`, `get_page`, `list_projects`, `list_articles`,
`ask_felipe`, `leave_message` — full descriptions and examples in
[docs/mcp.md](https://github.com/fst-it/fst_website/blob/main/docs/mcp.md).

## License

MIT
