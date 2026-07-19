# CloudPanel MCP Server v2

47 tools — manage your VPS, CloudPanel sites, Docker, and deploy apps from AI.

## 47 Tools

### CloudPanel (26)
`cloudpanel_list_sites` `cloudpanel_create_php_site` `cloudpanel_create_nodejs_site`
`cloudpanel_create_reverse_proxy_site` `cloudpanel_create_static_site` `cloudpanel_delete_site`
`cloudpanel_install_ssl` `cloudpanel_list_ssl_certificates`
`cloudpanel_create_mysql_database` `cloudpanel_create_mysql_user`
`cloudpanel_delete_mysql_database` `cloudpanel_delete_mysql_user`
`cloudpanel_create_postgresql_database` `cloudpanel_export_database` `cloudpanel_import_database`
`cloudpanel_system_info` `cloudpanel_system_update`
`cloudpanel_list_users` `cloudpanel_create_user` `cloudpanel_delete_user`
`cloudpanel_enable_2fa` `cloudpanel_disable_2fa`
`cloudpanel_create_backup` `cloudpanel_list_backups` `cloudpanel_delete_backup`

### Docker (9)
`docker_list_containers` `docker_deploy_compose` `docker_container_logs`
`docker_stop_container` `docker_restart_container` `docker_list_images`
`docker_prune` `docker_exec` `docker_load_image`

### Server Install (8)
`server_install_docker` — method: auto|official|apt, version pin, dryRun flag
`server_install_postgresql` — version flag, clientOnly flag, dryRun flag
`server_install_nodejs` — method: nodesource|nvm, version, dryRun flag
`server_install_nginx` — dryRun flag
`server_install_certbot` — dryRun flag
`server_install_redis` — dryRun flag
`server_install_mysql` — version, rootPassword, dryRun flag
`server_software_status` — check what's installed (detailed flag)

### Firewall & DNS (3)
`server_firewall_status` — check UFW/iptables + listening ports
`server_firewall_allow_port` — open a port
`server_dns_check` — verify DNS points to your server

### Deploy (1)
`deploy_autoforge` — method: docker|cloudpanel-reverse-proxy|cloudpanel-nodejs
   Deploys autoaveriq.ca + api.dealers.autoaveriq.ca with:
   - Auto-installs Docker if needed
   - Pre-deploy backup
   - Optional Let's Encrypt SSL
   - Optional migrations
   - Port config, secret key, DB URL all configurable

### Escape Hatch
`cloudpanel_raw_command` — run any shell command

## Install

```bash
cd /home/jishh/Desktop/cloudpanel-mcp-server
npm install && npm run build
```

Already configured in OpenCode at `~/.config/opencode/opencode.jsonc`.

## Example Queries

- "Check what's installed: `server_software_status`"
- "Install Docker with `dryRun=true` first to see what would happen"
- "Deploy AutoForge with method=cloudpanel-reverse-proxy"
- "Check if my DNS points here: `server_dns_check domain=autoaveriq.ca`"
- "Open port 8000 for the backend: `server_firewall_allow_port port=8000`"
- "List sites and install SSL for autoaveriq.ca"
- "Install Node.js 22 with method=nvm"
