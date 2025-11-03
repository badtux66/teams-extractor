# Teams Extractor MCP Claude Extension

This directory contains the manifest and documentation used to package the Teams Extractor MCP server as a Claude Desktop extension. The generated package lets you install the MCP server from Claude Desktop → **Developer → Extensions → Install Extension** without editing configuration files by hand.

## Building the Package

Use the helper script from the repository root:

```bash
bash scripts/build_claude_extension.sh
```

The script performs the following steps:

1. Copies the Claude manifest and MCP server sources into `dist/claude-extension/teams-extractor-mcp/`
2. Installs production-only npm dependencies for the server
3. Archives everything into `dist/claude-extension/teams-extractor-mcp.zip`

## Installing in Claude Desktop

1. Run the build script above
2. Open Claude Desktop on your machine
3. Navigate to **Developer → Extensions → Install Extension**
4. Select the generated `teams-extractor-mcp.zip`
5. When prompted, provide the PostgreSQL connection string used by Teams Extractor
6. Restart Claude Desktop so the new MCP server is available

After installation you should see the `teams-extractor-mcp` server listed with its tools in the Claude Desktop extension manager.
