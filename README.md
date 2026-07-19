# CloudPanel MCP Server

<div align="center">

**50 tools** to manage your CloudPanel VPS through any AI — Claude, Cursor, OpenCode, Gemini CLI, Kiro, Windsurf, Cline, and more.

[![npm](https://img.shields.io/npm/v/cloudpanel-mcp?color=blue&logo=npm)](https://www.npmjs.com/package/cloudpanel-mcp)
[![Docker Hub](https://img.shields.io/docker/v/heyyjish/cloudpanel-mcp?color=blue&logo=docker)](https://hub.docker.com/r/heyyjish/cloudpanel-mcp)
[![PyPI](https://img.shields.io/pypi/v/cloudpanel-mcp?color=blue&logo=pypi)](https://pypi.org/project/cloudpanel-mcp/)
[![GitHub](https://img.shields.io/github/stars/heyjishh/cloudpanel-mcp?logo=github)](https://github.com/heyjishh/cloudpanel-mcp)

</div>

## Quick Start

```bash
# 1. Install & configure for your AI tools (pick one):
npx cloudpanel-mcp install           # npm
docker run --rm heyyjish/cloudpanel-mcp:latest install   # Docker
pip install cloudpanel-mcp && cloudpanel-mcp install     # Python

# 2. Connect to your server (pick one):
#    SSH key:   ssh-copy-id root@your-server.com
#    Password:  Set CP_PASSWORD env var

# 3. Start using it
#    "Check what's installed on my server"
#    "Create a MySQL database called myapp"
#    "Install Docker and deploy my app"
```

## 50 Tools

| Category | Tools | What you can do |
|---|---|---|
| **CloudPanel** (26) | `cloudpanel_list_sites`, `cloudpanel_create_php_site`, `cloudpanel_create_nodejs_site`, `cloudpanel_create_python_site`, `cloudpanel_create_reverse_proxy_site`, `cloudpanel_create_static_site`, `cloudpanel_delete_site`, `cloudpanel_install_ssl`, `cloudpanel_list_ssl_certificates`, `cloudpanel_create_mysql_database`, `cloudpanel_create_mysql_user`, `cloudpanel_delete_mysql_database`, `cloudpanel_delete_mysql_user`, `cloudpanel_create_postgresql_database`, `cloudpanel_export_database`, `cloudpanel_import_database`, `cloudpanel_system_info`, `cloudpanel_system_update`, `cloudpanel_list_users`, `cloudpanel_create_user`, `cloudpanel_delete_user`, `cloudpanel_enable_2fa`, `cloudpanel_disable_2fa`, `cloudpanel_create_backup`, `cloudpanel_list_backups`, `cloudpanel_delete_backup` | Sites · SSL · Databases · System · Users · Backups |
| **Docker** (10) | `docker_list_containers`, `docker_deploy_compose`, `docker_container_logs`, `docker_stop_container`, `docker_restart_container`, `docker_list_images`, `docker_prune`, `docker_exec`, `docker_load_image`, `docker_login` | Full Docker management · Registry login |
| **Server Install** (8) | `server_install_docker`, `server_install_postgresql`, `server_install_nodejs`, `server_install_nginx`, `server_install_certbot`, `server_install_redis`, `server_install_mysql`, `server_software_status` | One-shot installs with `dryRun`, `method`, `version` flags |
| **Firewall & DNS** (3) | `server_firewall_status`, `server_firewall_allow_port`, `server_dns_check` | Security · Networking |
| **Deploy** (1) | `deploy_project` | One-shot full stack deploy with `method` flag: `docker`, `cloudpanel-reverse-proxy`, `cloudpanel-nodejs` |
| **Escape Hatch** (1) | `cloudpanel_raw_command` | Run any shell command |

## Installation

### Auto-install (all platforms)

```bash
npx cloudpanel-mcp install
```

Scans your machine and configures every AI tool it finds.

### Manual per platform

#### npm
```json
{
  "mcpServers": {
    "cloudpanel": {
      "command": "npx",
      "args": ["-y", "cloudpanel-mcp"],
      "env": {
        "CP_USER": "root",
        "CP_SSH_KEY": "/home/you/.ssh/id_ed25519",
        "CP_HOST": "your-server.com"
      }
    }
  }
}
```

#### Docker
```json
{
  "mcpServers": {
    "cloudpanel": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-v", "/home/you/.ssh:/root/.ssh", "-e", "CP_HOST", "-e", "CP_USER", "-e", "CP_SSH_KEY", "heyyjish/cloudpanel-mcp:latest"],
      "env": {
        "CP_USER": "root",
        "CP_SSH_KEY": "/home/you/.ssh/id_ed25519",
        "CP_HOST": "your-server.com"
      }
    }
  }
}
```

#### pip
```json
{
  "mcpServers": {
    "cloudpanel": {
      "command": "cloudpanel-mcp",
      "args": [],
      "env": {
        "CP_USER": "root",
        "CP_SSH_KEY": "/home/you/.ssh/id_ed25519",
        "CP_HOST": "your-server.com"
      }
    }
  }
}
```

### Supported platforms

- **OpenCode** — `~/.config/opencode/opencode.jsonc`
- **Claude Desktop** — `claude_desktop_config.json`
- **Cursor** — `~/.cursor/mcp.json`
- **Windsurf** — `~/.codeium/windsurf/mcp_config.json`
- **Cline** — `~/.config/cline/mcp_settings.json`
- **Gemini CLI** — `~/.config/gemini/config.json`
- **Kiro** — `~/.config/kiro/config.json`
- **Continue (VS Code)** — `~/.continue/config.json`

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CP_HOST` | `your-server.com` | Server hostname or IP |
| `CP_USER` | `root` | SSH user |
| `CP_SSH_KEY` | `~/.ssh/id_ed25519` | SSH private key (omit for password auth) |
| `CP_PASSWORD` | — | SSH password (used when no key set) |
| `CP_SSH_PORT` | `22` | SSH port |

## Install Methods

### npm (recommended)
```bash
npx cloudpanel-mcp install
# or install globally:
npm install -g cloudpanel-mcp && cloudpanel-mcp install
```

### Docker
```bash
docker run --rm -v ~/.ssh:/root/.ssh heyyjish/cloudpanel-mcp:latest install
# Run as MCP server (for MCP configs that support Docker):
docker run --rm -i -v ~/.ssh:/root/.ssh \
  -e CP_HOST=your-server.com \
  heyyjish/cloudpanel-mcp:latest
```

### pip / uv
```bash
pip install cloudpanel-mcp && cloudpanel-mcp install
# or with uv:
uv tool install cloudpanel-mcp && cloudpanel-mcp install
```

## Architecture

```
├── src/
│   ├── index.ts      # MCP server — 50 tools registered
│   ├── cli.ts        # CLI entry — install, help, serve
│   └── ssh.ts        # Persistent SSH client with auto-reconnect
├── python/           # Python CLI wrapper (pip/uv)
├── Dockerfile        # Docker image
└── build/            # Compiled output
```

The server establishes a single persistent SSH connection with keepalive and auto-reconnect.
No per-command connection overhead.

## Deploying Apps

### One-shot deploy

```bash
# Deploy with Docker (auto-installs Docker if missing)
deploy_project method=docker autoSsl=true frontendDomain=mysite.com

# Deploy behind CloudPanel reverse proxy
deploy_project method=cloudpanel-reverse-proxy autoSsl=true

# Deploy as CloudPanel-managed Node.js app
deploy_project method=cloudpanel-nodejs
```

### Install prerequisites first

```bash
# Preview what would be installed
server_install_docker dryRun=true

# Actually install
server_install_docker method=official

# Install PostgreSQL 16
server_install_postgresql version=16

# Install Node.js 22 via nvm
server_install_nodejs method=nvm version=--lts
```

## Prerequisites

- A VPS running [CloudPanel](https://www.cloudpanel.io) (v2+)
- SSH access to the server as root
- Node.js 18+ on the machine running the MCP

## License

MIT
