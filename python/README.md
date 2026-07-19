# cloudpanel-mcp

Python CLI wrapper for the [CloudPanel MCP](https://github.com/heyjishh/cloudpanel-mcp) server.

Manages CloudPanel sites, databases, SSL certificates, Docker containers, and deploys apps — all through AI.

## Install

```bash
pip install cloudpanel-mcp
# or
uv tool install cloudpanel-mcp
```

## Usage

```bash
# Configure for your AI tools
cloudpanel-mcp install

# Start MCP server
cloudpanel-mcp

# Show help
cloudpanel-mcp help
```

Requires Node.js 18+ (needed to run the underlying MCP server via npx).
