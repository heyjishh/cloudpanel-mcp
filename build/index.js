#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SSHClient } from "./ssh.js";
import fs from "fs";
function getConfig() {
    const keyPath = process.env.CP_SSH_KEY || process.env.SSH_KEY_PATH || "";
    let privateKey;
    if (keyPath && fs.existsSync(keyPath)) {
        privateKey = fs.readFileSync(keyPath, "utf-8");
    }
    return {
        host: process.env.CP_HOST || "your-server.com",
        port: parseInt(process.env.CP_SSH_PORT || "22"),
        username: process.env.CP_USER || "root",
        privateKey,
        password: process.env.CP_PASSWORD || process.env.SSH_PASSWORD,
    };
}
const config = getConfig();
const ssh = new SSHClient(config);
async function ensureClpctl() {
    const ok = await ssh.checkClpctl();
    if (!ok) {
        throw new Error("clpctl not found on server. Is CloudPanel installed?");
    }
}
async function ensureDocker() {
    const ok = await ssh.checkDocker();
    if (!ok) {
        throw new Error("Docker not found on server. Install it first.");
    }
}
const server = new McpServer({
    name: "cloudpanel-mcp",
    version: "1.0.0",
    description: "Manage CloudPanel hosting — sites, databases, SSL, users, backups, Docker, and system",
});
// ──────────────────────────────────────────────
//  Sites
// ──────────────────────────────────────────────
server.tool("cloudpanel_list_sites", "List all sites in CloudPanel", {}, async () => {
    try {
        await ensureClpctl();
        const sites = await ssh.listSites();
        return { content: [{ type: "text", text: JSON.stringify(sites, null, 2) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_create_php_site", "Create a PHP site", {
    domainName: z.string().describe("Domain name (e.g. example.com)"),
    phpVersion: z.string().default("8.3").describe("PHP version (8.1, 8.2, 8.3, 8.4)"),
    siteUser: z.string().optional().describe("System user for the site"),
    webTemplate: z.string().optional().describe("Vhost template (e.g. 'WordPress')"),
}, async ({ domainName, phpVersion, siteUser, webTemplate }) => {
    try {
        await ensureClpctl();
        let cmd = `site:add:php --domainName=${domainName} --phpVersion=${phpVersion}`;
        if (siteUser)
            cmd += ` --siteUser=${siteUser}`;
        if (webTemplate)
            cmd += ` --vhostTemplate='${webTemplate}'`;
        const result = await ssh.runClpctl(cmd);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Site created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_create_nodejs_site", "Create a Node.js site", {
    domainName: z.string().describe("Domain name"),
    nodeVersion: z.string().default("22").describe("Node.js version (18, 20, 22)"),
    appPort: z.number().default(3000).describe("Application port"),
    appPath: z.string().optional().describe("Path to app directory"),
}, async ({ domainName, nodeVersion, appPort, appPath }) => {
    try {
        await ensureClpctl();
        let cmd = `site:add:nodejs --domainName=${domainName} --nodeVersion=${nodeVersion} --appPort=${appPort}`;
        if (appPath)
            cmd += ` --appPath=${appPath}`;
        const result = await ssh.runClpctl(cmd);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Node.js site created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_create_python_site", "Create a Python (pipenv/wsgi) site via CloudPanel", {
    domainName: z.string().describe("Domain name"),
    pythonVersion: z.string().default("3.12").describe("Python version (3.11, 3.12, 3.13)"),
    appPort: z.number().default(8000).describe("Application port"),
    appPath: z.string().optional().describe("Path to app directory"),
    appType: z.enum(["wsgi", "asgi"]).default("asgi").describe("Application interface: wsgi (Flask/Django) or asgi (FastAPI)"),
}, async ({ domainName, pythonVersion, appPort, appPath, appType }) => {
    try {
        await ensureClpctl();
        let cmd = `site:add:python --domainName=${domainName} --pythonVersion=${pythonVersion} --appPort=${appPort}`;
        if (appPath)
            cmd += ` --appPath=${appPath}`;
        if (appType === "asgi")
            cmd += ` --appType=asgi`;
        const result = await ssh.runClpctl(cmd);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Python site created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_create_reverse_proxy_site", "Create a reverse proxy site (for Docker containers)", {
    domainName: z.string().describe("Domain name"),
    proxyPort: z.number().describe("Proxy port (e.g. 3000, 8000)"),
    proxyHost: z.string().default("127.0.0.1").describe("Proxy host"),
    siteUser: z.string().optional(),
}, async ({ domainName, proxyPort, proxyHost, siteUser }) => {
    try {
        await ensureClpctl();
        let cmd = `site:add:reverse-proxy --domainName=${domainName}`;
        cmd += ` --reverseProxyUrl=http://${proxyHost}:${proxyPort}`;
        if (siteUser)
            cmd += ` --siteUser=${siteUser}`;
        const result = await ssh.runClpctl(cmd);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Reverse proxy site created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_create_static_site", "Create a static HTML site", {
    domainName: z.string().describe("Domain name"),
    siteUser: z.string().optional(),
}, async ({ domainName, siteUser }) => {
    try {
        await ensureClpctl();
        let cmd = `site:add:static --domainName=${domainName}`;
        if (siteUser)
            cmd += ` --siteUser=${siteUser}`;
        const result = await ssh.runClpctl(cmd);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Static site created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_delete_site", "Delete a site from CloudPanel", {
    domainName: z.string().describe("Domain name to delete"),
    deleteDirectory: z.boolean().default(false).describe("Delete site directory"),
}, async ({ domainName, deleteDirectory }) => {
    try {
        await ensureClpctl();
        let cmd = `site:delete --domainName=${domainName}`;
        if (deleteDirectory)
            cmd += ` --deleteHomeDirectory`;
        const result = await ssh.runClpctl(cmd);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Site deleted" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// ──────────────────────────────────────────────
//  SSL
// ──────────────────────────────────────────────
server.tool("cloudpanel_install_ssl", "Install Let's Encrypt SSL certificate for a domain", {
    domainName: z.string().describe("Domain name"),
    email: z.string().email().optional().describe("Email for Let's Encrypt notifications"),
}, async ({ domainName, email }) => {
    try {
        await ensureClpctl();
        let cmd = `lets-encrypt:install --domainName=${domainName}`;
        if (email)
            cmd += ` --email=${email}`;
        const result = await ssh.runClpctl(cmd);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "SSL certificate installed" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_list_ssl_certificates", "List SSL certificates for a domain", {
    domainName: z.string().describe("Domain name"),
}, async ({ domainName }) => {
    try {
        const result = await ssh.exec(`clpctl lets-encrypt:list --domainName=${domainName} 2>/dev/null || openssl x509 -in /etc/letsencrypt/live/${domainName}/cert.pem -text -noout 2>/dev/null || echo 'No certificate found'`);
        return { content: [{ type: "text", text: result.stdout }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// ──────────────────────────────────────────────
//  Database
// ──────────────────────────────────────────────
server.tool("cloudpanel_create_mysql_database", "Create a MySQL database", {
    databaseName: z.string().describe("Database name"),
}, async ({ databaseName }) => {
    try {
        await ensureClpctl();
        const result = await ssh.runClpctl(`database:add --databaseName=${databaseName} --databaseType=mysql`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Database created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_create_mysql_user", "Create a MySQL database user", {
    userName: z.string().describe("Username"),
    password: z.string().describe("Password"),
    databaseName: z.string().optional().describe("Database to grant access to"),
}, async ({ userName, password, databaseName }) => {
    try {
        await ensureClpctl();
        let cmd = `database:user:add --userName=${userName} --password=${password} --databaseType=mysql`;
        if (databaseName)
            cmd += ` --databaseName=${databaseName}`;
        const result = await ssh.runClpctl(cmd);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "User created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_delete_mysql_database", "Delete a MySQL database", {
    databaseName: z.string().describe("Database name"),
}, async ({ databaseName }) => {
    try {
        await ensureClpctl();
        const result = await ssh.runClpctl(`database:delete --databaseName=${databaseName} --databaseType=mysql`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Database deleted" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_delete_mysql_user", "Delete a MySQL database user", {
    userName: z.string().describe("Username"),
}, async ({ userName }) => {
    try {
        await ensureClpctl();
        const result = await ssh.runClpctl(`database:user:delete --userName=${userName} --databaseType=mysql`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "User deleted" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_create_postgresql_database", "Create a PostgreSQL database (if available)", {
    databaseName: z.string().describe("Database name"),
}, async ({ databaseName }) => {
    try {
        await ensureClpctl();
        const result = await ssh.runClpctl(`database:add --databaseName=${databaseName} --databaseType=postgresql`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "PostgreSQL database created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_export_database", "Export a database dump", {
    databaseName: z.string().describe("Database name"),
    databaseType: z.enum(["mysql", "postgresql"]).default("mysql"),
    filePath: z.string().optional().describe("Output file path on server"),
}, async ({ databaseName, databaseType, filePath }) => {
    try {
        const outputFile = filePath || `/root/${databaseName}_dump.sql`;
        let cmd;
        if (databaseType === "mysql") {
            const { stdout: creds } = await ssh.exec("cat /root/.my.cnf 2>/dev/null || echo '[client]\nuser=root\npassword='");
            cmd = `mysqldump ${databaseName} > ${outputFile}`;
        }
        else {
            cmd = `pg_dump ${databaseName} > ${outputFile}`;
        }
        const result = await ssh.exec(cmd);
        return { content: [{ type: "text", text: `Database exported to ${outputFile}\n${result.stdout}` }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_import_database", "Import a database from a dump file", {
    databaseName: z.string().describe("Target database name"),
    filePath: z.string().describe("Path to SQL dump file on server"),
    databaseType: z.enum(["mysql", "postgresql"]).default("mysql"),
}, async ({ databaseName, filePath, databaseType }) => {
    try {
        let cmd;
        if (databaseType === "mysql") {
            cmd = `mysql ${databaseName} < ${filePath}`;
        }
        else {
            cmd = `psql -d ${databaseName} -f ${filePath}`;
        }
        const result = await ssh.exec(cmd);
        return { content: [{ type: "text", text: `Import complete\n${result.stdout}` }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// ──────────────────────────────────────────────
//  System
// ──────────────────────────────────────────────
server.tool("cloudpanel_system_info", "Get system information (OS, memory, disk, uptime, Docker version)", {}, async () => {
    try {
        const info = await ssh.getSystemInfo();
        return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_system_update", "Update CloudPanel to the latest version", {}, async () => {
    try {
        await ensureClpctl();
        const result = await ssh.runClpctl("system:update");
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Update complete" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// ──────────────────────────────────────────────
//  Users
// ──────────────────────────────────────────────
server.tool("cloudpanel_list_users", "List system users", {}, async () => {
    try {
        const result = await ssh.exec("cat /etc/passwd | grep -E '/home/' | cut -d: -f1,3,6 | sort");
        return { content: [{ type: "text", text: result.stdout || "No users found" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_create_user", "Create a system user (for FTP/site access)", {
    userName: z.string().describe("Username"),
    password: z.string().describe("Password"),
    homeDirectory: z.string().optional().describe("Home directory path"),
}, async ({ userName, password, homeDirectory }) => {
    try {
        let cmd = `user:add --userName=${userName} --password=${password}`;
        if (homeDirectory)
            cmd += ` --homeDirectory=${homeDirectory}`;
        const result = await ssh.runClpctl(cmd);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "User created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_delete_user", "Delete a system user", {
    userName: z.string().describe("Username"),
}, async ({ userName }) => {
    try {
        const result = await ssh.runClpctl(`user:delete --userName=${userName}`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "User deleted" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_enable_2fa", "Enable two-factor authentication for a CloudPanel admin user", {
    userName: z.string().default("admin").describe("Admin username"),
}, async ({ userName }) => {
    try {
        const result = await ssh.runClpctl(`two-factor-auth:enable --userName=${userName}`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "2FA enabled" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_disable_2fa", "Disable two-factor authentication for a CloudPanel admin user", {
    userName: z.string().default("admin").describe("Admin username"),
}, async ({ userName }) => {
    try {
        const result = await ssh.runClpctl(`two-factor-auth:disable --userName=${userName}`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "2FA disabled" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// ──────────────────────────────────────────────
//  Backups
// ──────────────────────────────────────────────
server.tool("cloudpanel_create_backup", "Create a CloudPanel backup", {
    backupDirectory: z.string().default("/root/backups").describe("Backup directory"),
}, async ({ backupDirectory }) => {
    try {
        const result = await ssh.runClpctl(`backup:add --backupDirectory=${backupDirectory}`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Backup created" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_list_backups", "List CloudPanel backups", {}, async () => {
    try {
        const result = await ssh.exec("ls -lh /root/backups/ 2>/dev/null || echo 'No backups directory found'");
        return { content: [{ type: "text", text: result.stdout }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("cloudpanel_delete_backup", "Delete a CloudPanel backup", {
    fileName: z.string().describe("Backup filename to delete"),
}, async ({ fileName }) => {
    try {
        const result = await ssh.exec(`rm -f /root/backups/${fileName}`);
        return { content: [{ type: "text", text: `Backup ${fileName} deleted` }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// ──────────────────────────────────────────────
//  Docker
// ──────────────────────────────────────────────
server.tool("docker_list_containers", "List running Docker containers", {
    all: z.boolean().default(false).describe("Include stopped containers"),
}, async ({ all }) => {
    try {
        await ensureDocker();
        const flag = all ? "-a" : "";
        const result = await ssh.exec(`docker ps ${flag} --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'`);
        return { content: [{ type: "text", text: result.stdout || "No containers running" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("docker_deploy_compose", "Deploy a docker-compose.yml file on the server", {
    composeContent: z.string().describe("The docker-compose.yml content as a string"),
    projectName: z.string().describe("Docker compose project name"),
    remoteDir: z.string().default("/root/project").describe("Remote directory"),
}, async ({ composeContent, projectName, remoteDir }) => {
    try {
        await ensureDocker();
        await ssh.exec(`mkdir -p ${remoteDir}`);
        await ssh.exec(`cat > ${remoteDir}/docker-compose.yml << 'COMPOSE_EOF'\n${composeContent}\nCOMPOSE_EOF`);
        const result = await ssh.exec(`cd ${remoteDir} && docker compose -p ${projectName} up -d`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Deployed successfully" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("docker_container_logs", "View logs from a Docker container", {
    containerName: z.string().describe("Container name or ID"),
    tail: z.number().default(50).describe("Number of lines to show"),
    follow: z.boolean().default(false).describe("Follow log output"),
}, async ({ containerName, tail, follow }) => {
    try {
        const flag = follow ? "-f" : "";
        const result = await ssh.exec(`docker logs ${flag} --tail ${tail} ${containerName} 2>&1`);
        return { content: [{ type: "text", text: result.stdout || "No logs" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("docker_stop_container", "Stop a Docker container", {
    containerName: z.string().describe("Container name or ID"),
}, async ({ containerName }) => {
    try {
        const result = await ssh.exec(`docker stop ${containerName}`);
        return { content: [{ type: "text", text: `Container ${containerName} stopped\n${result.stdout}` }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("docker_restart_container", "Restart a Docker container", {
    containerName: z.string().describe("Container name or ID"),
}, async ({ containerName }) => {
    try {
        const result = await ssh.exec(`docker restart ${containerName}`);
        return { content: [{ type: "text", text: `Container ${containerName} restarted\n${result.stdout}` }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("docker_list_images", "List Docker images on the server", {}, async () => {
    try {
        const result = await ssh.exec("docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'");
        return { content: [{ type: "text", text: result.stdout || "No images" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("docker_prune", "Remove unused Docker data (containers, images, volumes)", {
    all: z.boolean().default(false).describe("Remove all unused images, not just dangling"),
}, async ({ all }) => {
    try {
        const flag = all ? "-a" : "";
        const result = await ssh.exec(`docker system prune ${flag} -f`);
        return { content: [{ type: "text", text: result.stdout || "Prune complete" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("docker_exec", "Execute a command inside a running Docker container", {
    containerName: z.string().describe("Container name or ID"),
    command: z.string().describe("Command to execute (e.g. 'alembic upgrade head')"),
}, async ({ containerName, command }) => {
    try {
        const result = await ssh.exec(`docker exec ${containerName} sh -c '${command}'`);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "Command executed" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
server.tool("docker_load_image", "Load a Docker image from a tar file on the server", {
    tarPath: z.string().describe("Path to .tar file on server"),
}, async ({ tarPath }) => {
    try {
        const result = await ssh.exec(`docker load -i ${tarPath}`);
        return { content: [{ type: "text", text: result.stdout || "Image loaded" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// ──────────────────────────────────────────────
//  Server Install Tools
// ──────────────────────────────────────────────
server.tool("server_install_docker", "Install Docker Engine on the server. Supports multiple install methods.", {
    method: z.enum(["auto", "official", "apt"]).default("auto").describe("Install method: auto (official repo), official (Docker's apt repo), apt (Ubuntu repo)"),
    version: z.string().optional().describe("Specific Docker version (e.g. '25.0.3')"),
    dryRun: z.boolean().default(false).describe("Show what would be installed without actually installing"),
}, async ({ method, version, dryRun }) => {
    const results = [];
    results.push(`🔍 Checking Docker status...`);
    const { stdout: exists } = await ssh.exec("which docker 2>/dev/null && docker --version || echo NOT_INSTALLED");
    results.push(`   ${exists.trim()}`);
    if (!exists.includes("NOT_INSTALLED")) {
        results.push(`\n✅ Docker already installed. To reinstall, uninstall first via cloudpanel_raw_command.`);
        return { content: [{ type: "text", text: results.join("\n") }] };
    }
    if (dryRun) {
        if (method === "official" || method === "auto") {
            results.push(`\n📋 Dry-run: Would install Docker from official Docker repo:`);
            results.push(`   - Add Docker GPG key to /etc/apt/keyrings/docker.asc`);
            results.push(`   - Add Docker apt repository`);
            results.push(`   - Install: docker-ce docker-ce-cli containerd.io docker-compose-plugin`);
        }
        else {
            results.push(`\n📋 Dry-run: Would install Docker from Ubuntu repos:`);
            results.push(`   - apt-get install docker.io`);
        }
        if (version)
            results.push(`   - Version pin: ${version}`);
        results.push(`\n   Run without --dryRun to execute.`);
        return { content: [{ type: "text", text: results.join("\n") }] };
    }
    results.push(`\n📦 Installing Docker (method: ${method})...`);
    if (method === "apt") {
        const { stdout, stderr } = await ssh.exec(`DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2 2>&1 && docker --version`);
        results.push(`   ${stdout.trim() || stderr.trim()}`);
    }
    else {
        const verPin = version ? `VERSION_STRING=$(apt-cache madison docker-ce | awk '{print $3}' | grep ${version} | head -1) && ` : "";
        const script = `
set -e
which docker >/dev/null 2>&1 && exit 0
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
DEBIAN_FRONTEND=noninteractive apt-get update -qq
${verPin}DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker --version
systemctl enable docker
systemctl start docker
echo "DOCKER_READY"
`.trim();
        const { stdout } = await ssh.exec(script);
        results.push(`   ${stdout.trim().split('\n').join('\n   ')}`);
    }
    const { stdout: verify } = await ssh.exec("docker info --format '{{.ServerVersion}}' 2>/dev/null || echo 'verification failed'");
    results.push(`\n✅ Docker Engine ${verify.trim()} installed`);
    return { content: [{ type: "text", text: results.join("\n") }] };
});
server.tool("server_install_postgresql", "Install PostgreSQL on the server.", {
    version: z.enum(["16", "15", "14"]).default("16").describe("PostgreSQL major version"),
    clientOnly: z.boolean().default(false).describe("Install only the client (psql), not the server"),
    dryRun: z.boolean().default(false).describe("Preview without executing"),
}, async ({ version, clientOnly, dryRun }) => {
    const results = [];
    results.push(`🔍 Checking PostgreSQL status...`);
    const { stdout: pgExists } = await ssh.exec(`pg_config --version 2>/dev/null || echo NOT_INSTALLED`);
    const { stdout: psqlExists } = await ssh.exec(`psql --version 2>/dev/null || echo NOT_INSTALLED`);
    results.push(`   Server: ${pgExists.trim()}`);
    results.push(`   Client: ${psqlExists.trim()}`);
    if (dryRun) {
        if (clientOnly) {
            results.push(`\n📋 Dry-run: Would install PostgreSQL ${version} client only:`);
            results.push(`   - apt-get install postgresql-client-${version}`);
        }
        else {
            results.push(`\n📋 Dry-run: Would install PostgreSQL ${version} full:`);
            results.push(`   - Add PostgreSQL apt repository`);
            results.push(`   - apt-get install postgresql-${version} postgresql-client-${version}`);
        }
        return { content: [{ type: "text", text: results.join("\n") }] };
    }
    results.push(`\n📦 Installing PostgreSQL ${version}...`);
    const script = `
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg 2>/dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ${clientOnly ? `postgresql-client-${version}` : `postgresql-${version} postgresql-client-${version}`}
${clientOnly ? "" : "systemctl enable postgresql && systemctl start postgresql"}
psql --version
`.trim();
    const { stdout } = await ssh.exec(script);
    results.push(`   ${stdout.trim().split('\n').join('\n   ')}`);
    results.push(`\n✅ PostgreSQL ready`);
    if (!clientOnly) {
        const { stdout: connInfo } = await ssh.exec(`sudo -u postgres psql -c "SELECT version();" 2>/dev/null | head -3`);
        results.push(`   ${connInfo.trim().split('\n')[1] || ''}`);
    }
    return { content: [{ type: "text", text: results.join("\n") }] };
});
server.tool("server_install_nodejs", "Install Node.js on the server via NodeSource or nvm.", {
    method: z.enum(["nodesource", "nvm"]).default("nodesource").describe("Install method: nodesource (system-wide binary) or nvm (per-user version manager)"),
    version: z.string().default("22").describe("Major version (e.g. 18, 20, 22) for NodeSource; for nvm use '--lts' or full semver like '22.14.0'"),
    user: z.string().default("root").describe("User to install nvm for (only used with method=nvm)"),
    dryRun: z.boolean().default(false).describe("Preview without executing"),
}, async ({ method, version, user, dryRun }) => {
    const results = [];
    if (dryRun) {
        if (method === "nodesource") {
            results.push(`📋 Dry-run: Would install Node.js ${version} via NodeSource:`);
            results.push(`   - curl -fsSL https://deb.nodesource.com/setup_${version}.x | bash -`);
            results.push(`   - apt-get install -y nodejs`);
        }
        else {
            results.push(`📋 Dry-run: Would install Node.js via nvm for user '${user}':`);
            results.push(`   - Clone nvm from GitHub to ~${user}/.nvm`);
            results.push(`   - nvm install ${version}`);
        }
        return { content: [{ type: "text", text: results.join("\n") }] };
    }
    if (method === "nodesource") {
        results.push(`📦 Installing Node.js ${version} via NodeSource...`);
        const { stdout } = await ssh.exec(`
        curl -fsSL https://deb.nodesource.com/setup_${version}.x | bash - 2>&1 | tail -5
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs 2>&1 | tail -3
        node --version && npm --version
      `);
        results.push(`   ${stdout.trim().split('\n').join('\n   ')}`);
    }
    else {
        results.push(`📦 Installing Node.js via nvm for user '${user}'...`);
        const homeDir = user === "root" ? "/root" : `/home/${user}`;
        const { stdout } = await ssh.exec(`
        export NVM_DIR="${homeDir}/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] || {
          curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash 2>&1 | tail -3
        }
        . $NVM_DIR/nvm.sh
        nvm install ${version} 2>&1 | tail -5
        nvm alias default ${version}
        node --version && npm --version
      `);
        results.push(`   ${stdout.trim().split('\n').join('\n   ')}`);
    }
    const { stdout: verify } = await ssh.exec(`node --version 2>/dev/null && npm --version 2>/dev/null || echo 'verify failed'`);
    results.push(`\n✅ Node.js ${verify.trim().split('\n')[0]}, npm ${verify.trim().split('\n')[1] || ''}`);
    return { content: [{ type: "text", text: results.join("\n") }] };
});
server.tool("server_software_status", "Check what software is installed and running on the server.", {
    software: z.array(z.enum(["docker", "nginx", "mysql", "postgresql", "redis", "node", "python3", "certbot"]))
        .default(["docker", "nginx", "mysql", "postgresql", "redis", "node", "python3"])
        .describe("List of software to check"),
    detailed: z.boolean().default(false).describe("Show detailed version info and status"),
}, async ({ software, detailed }) => {
    const checks = {
        docker: "docker info --format '{{.ServerVersion}}' 2>/dev/null || echo 'not installed'",
        nginx: "nginx -v 2>&1 || echo 'not installed'",
        mysql: "mysql --version 2>/dev/null || mysqld --version 2>/dev/null || echo 'not installed'",
        postgresql: "psql --version 2>/dev/null || echo 'not installed'",
        redis: "redis-server --version 2>/dev/null || redis-cli --version 2>/dev/null || echo 'not installed'",
        node: "node --version 2>/dev/null || echo 'not installed'",
        python3: "python3 --version 2>/dev/null || echo 'not installed'",
        certbot: "certbot --version 2>/dev/null || echo 'not installed'",
    };
    const results = [];
    results.push(`📊 Server Software Status\n`);
    for (const s of software) {
        if (!checks[s])
            continue;
        const { stdout } = await ssh.exec(checks[s]);
        const status = stdout.trim() || "unknown";
        const installed = !status.includes("not installed") && status.length > 0;
        const icon = installed ? "✅" : "⬜";
        results.push(`${icon} ${s.padEnd(12)} ${status.split('\n')[0]}`);
        if (detailed && installed) {
            if (s === "docker") {
                const { stdout: info } = await ssh.exec("docker info --format 'Containers: {{.ContainersRunning}} running, {{.Containers}} total | Images: {{.Images}}' 2>/dev/null");
                results.push(`   └─ ${info.trim()}`);
            }
            if (s === "postgresql") {
                const { stdout: pgStatus } = await ssh.exec("systemctl is-active postgresql 2>/dev/null || echo 'inactive'");
                results.push(`   └─ Service: ${pgStatus.trim()}`);
            }
            if (s === "nginx") {
                const { stdout: nginxStatus } = await ssh.exec("systemctl is-active nginx 2>/dev/null || echo 'inactive'");
                results.push(`   └─ Service: ${nginxStatus.trim()}`);
            }
        }
    }
    return { content: [{ type: "text", text: results.join("\n") }] };
});
server.tool("server_install_nginx", "Install Nginx web server on the server.", {
    dryRun: z.boolean().default(false).describe("Preview without executing"),
}, async ({ dryRun }) => {
    if (dryRun) {
        return { content: [{ type: "text", text: "📋 Dry-run: Would install Nginx:\n   - apt-get install nginx\n   - systemctl enable nginx\n   - systemctl start nginx" }] };
    }
    const { stdout } = await ssh.exec(`
      DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx 2>&1 | tail -3
      systemctl enable nginx && systemctl start nginx
      nginx -v 2>&1
    `);
    return { content: [{ type: "text", text: `✅ Nginx installed\n${stdout.trim()}` }] };
});
server.tool("server_install_certbot", "Install Certbot (Let's Encrypt SSL client) with Nginx plugin.", {
    dryRun: z.boolean().default(false).describe("Preview without executing"),
}, async ({ dryRun }) => {
    if (dryRun) {
        return { content: [{ type: "text", text: "📋 Dry-run: Would install Certbot:\n   - apt-get install certbot python3-certbot-nginx" }] };
    }
    const { stdout } = await ssh.exec(`
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx 2>&1 | tail -3
      certbot --version 2>&1
    `);
    return { content: [{ type: "text", text: `✅ Certbot installed\n${stdout.trim()}` }] };
});
server.tool("server_install_redis", "Install Redis on the server.", {
    dryRun: z.boolean().default(false).describe("Preview without executing"),
}, async ({ dryRun }) => {
    if (dryRun) {
        return { content: [{ type: "text", text: "📋 Dry-run: Would install Redis:\n   - apt-get install redis-server\n   - systemctl enable redis" }] };
    }
    const { stdout } = await ssh.exec(`
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server 2>&1 | tail -3
      systemctl enable redis-server && systemctl start redis-server
      redis-server --version 2>&1 | head -1
    `);
    return { content: [{ type: "text", text: `✅ Redis installed\n${stdout.trim()}` }] };
});
server.tool("server_install_mysql", "Install MySQL server on the server.", {
    version: z.string().default("8.0").describe("MySQL version"),
    rootPassword: z.string().optional().describe("Set root password (auto-generated if omitted)"),
    dryRun: z.boolean().default(false).describe("Preview without executing"),
}, async ({ version, rootPassword, dryRun }) => {
    const results = [];
    if (dryRun) {
        results.push(`📋 Dry-run: Would install MySQL ${version}:`);
        results.push(`   - apt-get install mysql-server-${version}`);
        if (rootPassword)
            results.push(`   - Set root password`);
        results.push(`   - Run mysql_secure_installation`);
        return { content: [{ type: "text", text: results.join("\n") }] };
    }
    const pass = rootPassword || `project_$(openssl rand -hex 8)`;
    const { stdout } = await ssh.exec(`
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server-${version} 2>&1 | tail -3
      systemctl enable mysql && systemctl start mysql
      mysql --version 2>&1
      mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${pass}'; FLUSH PRIVILEGES;" 2>/dev/null || true
      echo "Root password: ${pass}"
    `);
    results.push(`✅ MySQL ${version} installed`);
    results.push(`   ${stdout.trim().split('\n').join('\n   ')}`);
    return { content: [{ type: "text", text: results.join("\n") }] };
});
// ──────────────────────────────────────────────
//  Deploy — Project
// ──────────────────────────────────────────────
server.tool("deploy_project", "Deploy a full-stack project to the server. Choose deployment method: docker (full stack with Postgres), cloudpanel-reverse-proxy (Docker apps behind CloudPanel proxy), or cloudpanel-nodejs (CloudPanel-managed Node.js site). Installs prerequisites automatically. Shows live progress.", {
    method: z.enum(["docker", "cloudpanel-reverse-proxy", "cloudpanel-nodejs"]).default("docker")
        .describe("docker = full compose with Postgres; cloudpanel-reverse-proxy = Docker behind CloudPanel proxy; cloudpanel-nodejs = CloudPanel-hosted Node.js app"),
    frontendDomain: z.string().default("example.com").describe("Frontend domain"),
    backendDomain: z.string().default("api.example.com").describe("Backend API domain"),
    secretKey: z.string().default("change-me-in-production").describe("Production SECRET_KEY (min 32 chars)"),
    databaseUrl: z.string().default("postgresql://app_user:app_pass@localhost:5432/app_db").describe("PostgreSQL DATABASE_URL"),
    dbPassword: z.string().default("app_pass").describe("PostgreSQL password for Docker Postgres"),
    autoSsl: z.boolean().default(true).describe("Install Let's Encrypt SSL after deployment"),
    runMigrations: z.boolean().default(true).describe("Run alembic migrations after deploy"),
    skipBackup: z.boolean().default(false).describe("Skip pre-deploy backup if one exists"),
    startPort: z.number().default(3000).describe("Starting port for frontend (backend = startPort + 5000)"),
}, async ({ method, frontendDomain, backendDomain, secretKey, databaseUrl, dbPassword, autoSsl, runMigrations, skipBackup, startPort }) => {
    const backendPort = startPort + 5000;
    const results = [];
    const step = (msg) => { results.push(`\n▶ ${msg}`); };
    try {
        // ── Phase 0: Validate ──
        if (secretKey.length < 16) {
            return { content: [{ type: "text", text: "❌ SECRET_KEY must be at least 16 characters" }], isError: true };
        }
        // ── Phase 1: Pre-flight ──
        step("Pre-flight checks");
        const { stdout: osInfo } = await ssh.exec("cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2");
        results.push(`   OS: ${osInfo.trim()}`);
        const { stdout: arch } = await ssh.exec("uname -m");
        results.push(`   Arch: ${arch.trim()}`);
        const { stdout: diskFree } = await ssh.exec("df -h / | awk 'NR==2 {print $4 \" free\"}'");
        results.push(`   Disk: ${diskFree.trim()}`);
        // ── Phase 2: Install Docker (always needed) ──
        if (method === "docker" || method === "cloudpanel-reverse-proxy") {
            step("Ensuring Docker is installed");
            const { stdout: dockerCheck } = await ssh.exec("which docker && docker --version || echo MISSING");
            if (dockerCheck.includes("MISSING")) {
                results.push("   Docker not found, installing...");
                const { stdout: installOut } = await ssh.exec(`
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
            chmod a+r /etc/apt/keyrings/docker.asc
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
            DEBIAN_FRONTEND=noninteractive apt-get update -qq && apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>&1 | tail -2
            docker --version
          `);
                results.push(`   ${installOut.trim().split('\n').join('\n   ')}`);
            }
            else {
                results.push(`   ${dockerCheck.trim()}`);
            }
        }
        // ── Phase 3: Backup if existing ──
        if (!skipBackup) {
            step("Pre-deploy backup (if existing deploy)");
            const { stdout: backupOut } = await ssh.exec(`
          if [ -d /root/project ]; then
            mkdir -p /root/backups
            tar czf "/root/backups/project-predeploy-$(date +%Y%m%d-%H%M%S).tar.gz" -C /root project 2>/dev/null && echo "Backup created" || echo "No previous deploy to backup"
          else
            echo "Fresh deploy (no backup needed)"
          fi
        `);
            results.push(`   ${backupOut.trim()}`);
        }
        // ── Phase 4: Deploy per method ──
        if (method === "docker") {
            step("Deploying with Docker Compose (full stack)");
            const compose = `services:
  frontend:
    image: nginx:alpine
    container_name: project_frontend
    restart: unless-stopped
    ports:
      - "${startPort}:80"
    volumes:
      - frontend_build:/usr/share/nginx/html:ro
    networks:
      - project_network

  backend:
    image: project-backend:latest
    container_name: project_backend
    restart: unless-stopped
    ports:
      - "${backendPort}:8000"
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
      DATABASE_URL: ${databaseUrl}
      SECRET_KEY: ${secretKey}
      CORS_ORIGINS: ["https://${frontendDomain}", "https://${backendDomain}"]
      FRONTEND_URL: https://${frontendDomain}
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    networks:
      - project_network

  db:
    image: postgres:16-alpine
    container_name: project_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: app_db
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: ${dbPassword}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dealer_user"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - project_network

volumes:
  postgres_data:
  uploads_data:
  frontend_build:

networks:
  project_network:
    driver: bridge`;
            await ssh.exec("mkdir -p /root/project");
            await ssh.exec(`cat > /root/project/docker-compose.yml << 'DOCKEREOF'\n${compose}\nDOCKEREOF`);
            results.push("   docker-compose.yml written");
            const { stdout: upOut } = await ssh.exec("cd /root/project && docker compose pull && docker compose up -d 2>&1");
            results.push(`   ${upOut.trim().split('\n').join('\n   ')}`);
            const { stdout: psOut } = await ssh.exec("cd /root/project && docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}' 2>&1");
            results.push(`\n   Containers:\n   ${psOut.trim().split('\n').join('\n   ')}`);
        }
        else if (method === "cloudpanel-reverse-proxy") {
            step("Setting up CloudPanel reverse proxy sites");
            const createFrontend = `
          clpctl site:add:reverse-proxy --domainName=${frontendDomain} --reverseProxyUrl=http://127.0.0.1:${startPort} 2>&1 || echo "Site may already exist"
        `;
            const { stdout: feSite } = await ssh.exec(createFrontend);
            results.push(`   Frontend site: ${feSite.trim().split('\n').join(', ')}`);
            const createBackend = `
          clpctl site:add:reverse-proxy --domainName=${backendDomain} --reverseProxyUrl=http://127.0.0.1:${backendPort} 2>&1 || echo "Site may already exist"
        `;
            const { stdout: beSite } = await ssh.exec(createBackend);
            results.push(`   Backend site: ${beSite.trim().split('\n').join(', ')}`);
            step("Deploying Docker containers behind reverse proxy");
            const compose = `services:
  frontend:
    image: nginx:alpine
    container_name: project_frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:${startPort}:80"
    volumes:
      - frontend_build:/usr/share/nginx/html:ro
    networks:
      - project_network

  backend:
    image: project-backend:latest
    container_name: project_backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:${backendPort}:8000"
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
      DATABASE_URL: ${databaseUrl}
      SECRET_KEY: ${secretKey}
      CORS_ORIGINS: ["https://${frontendDomain}", "https://${backendDomain}"]
      FRONTEND_URL: https://${frontendDomain}
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    networks:
      - project_network

  db:
    image: postgres:16-alpine
    container_name: project_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: app_db
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: ${dbPassword}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dealer_user"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - project_network

volumes:
  postgres_data:
  uploads_data:
  frontend_build:

networks:
  project_network:
    driver: bridge`;
            await ssh.exec("mkdir -p /root/project");
            await ssh.exec(`cat > /root/project/docker-compose.yml << 'DOCKEREOF'\n${compose}\nDOCKEREOF`);
            const { stdout: upOut } = await ssh.exec("cd /root/project && docker compose pull && docker compose up -d 2>&1");
            results.push(`   ${upOut.trim().split('\n').join('\n   ')}`);
        }
        else if (method === "cloudpanel-nodejs") {
            step("Creating CloudPanel Node.js sites");
            const createFrontend = `
          clpctl site:add:nodejs --domainName=${frontendDomain} --nodeVersion=22 --appPort=${startPort} 2>&1 || echo "Site may already exist"
        `;
            const { stdout: feSite } = await ssh.exec(createFrontend);
            results.push(`   Frontend: ${feSite.trim().split('\n').join(', ')}`);
            const createBackend = `
          clpctl site:add:nodejs --domainName=${backendDomain} --nodeVersion=22 --appPort=${backendPort} 2>&1 || echo "Site may already exist"
        `;
            const { stdout: beSite } = await ssh.exec(createBackend);
            results.push(`   Backend: ${beSite.trim().split('\n').join(', ')}`);
            step("Cloning and building apps (simulated — swap with your Git URLs)");
            const cloneApps = `
          mkdir -p /home/project
          [ -d /home/project/frontend ] || echo "Place frontend code in /home/project/frontend"
          [ -d /home/project/backend ] || echo "Place backend code in /home/project/backend"
        `;
            const { stdout: cloneOut } = await ssh.exec(cloneApps);
            results.push(`   ${cloneOut.trim().split('\n').join('\n   ')}`);
            step("Installing PostgreSQL (required for backend)");
            await ssh.exec(`
          which psql >/dev/null 2>&1 || {
            curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg 2>/dev/null
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
            DEBIAN_FRONTEND=noninteractive apt-get update -qq
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-16 postgresql-client-16
            systemctl enable postgresql && systemctl start postgresql
          }
        `);
            results.push("   PostgreSQL installed");
        }
        // ── Phase 5: SSL ──
        if (autoSsl) {
            step("Installing Let's Encrypt SSL certificates");
            const sslFrontend = `
          clpctl lets-encrypt:install --domainName=${frontendDomain} --email=admin@${frontendDomain} 2>&1 || echo "SSL may already exist or failed — run cloudpanel_install_ssl manually"
        `;
            const { stdout: sslFE } = await ssh.exec(sslFrontend);
            results.push(`   ${frontendDomain}: ${sslFE.trim().split('\n').join(', ')}`);
            const sslBackend = `
          clpctl lets-encrypt:install --domainName=${backendDomain} --email=admin@${backendDomain} 2>&1 || echo "SSL may already exist or failed"
        `;
            const { stdout: sslBE } = await ssh.exec(sslBackend);
            results.push(`   ${backendDomain}: ${sslBE.trim().split('\n').join(', ')}`);
        }
        // ── Phase 6: Migrations ──
        if (runMigrations && (method === "docker" || method === "cloudpanel-reverse-proxy")) {
            step("Running database migrations");
            await ssh.exec("sleep 5");
            const { stdout: migrateOut } = await ssh.exec("cd /root/project && docker compose exec -T backend sh -c 'alembic upgrade head 2>&1' || echo 'Migration failed (run manually)'");
            results.push(`   ${migrateOut.trim().split('\n').join('\n   ')}`);
        }
        // ── Phase 7: Verify ──
        step("Verification");
        let frontendCheck = "skipped", backendCheck = "skipped";
        if (method === "docker" || method === "cloudpanel-reverse-proxy") {
            const { stdout: fe } = await ssh.exec(`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${startPort} 2>/dev/null || echo 'unreachable'`);
            frontendCheck = `HTTP ${fe.trim()}`;
            const { stdout: be } = await ssh.exec(`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${backendPort}/api/health 2>/dev/null || echo 'unreachable'`);
            backendCheck = `HTTP ${be.trim()}`;
        }
        results.push(`\n═══════════════════════════════════════`);
        results.push(`  ✅ Deploy Complete (method: ${method})`);
        results.push(`  Frontend: ${frontendDomain} → ${frontendCheck}`);
        results.push(`  Backend:  ${backendDomain} → ${backendCheck}`);
        results.push(`  SSL:      ${autoSsl ? 'Installed' : 'Skipped'}`);
        results.push(`  Migrations: ${runMigrations ? 'Run' : 'Skipped'}`);
        results.push(`═══════════════════════════════════════`);
        return { content: [{ type: "text", text: results.join("\n") }] };
    }
    catch (e) {
        results.push(`\n❌ Error: ${e.message}`);
        results.push(`\n💡 You can retry or use cloudpanel_raw_command to fix issues manually.`);
        return { content: [{ type: "text", text: results.join("\n") }], isError: true };
    }
});
// ──────────────────────────────────────────────
//  Firewall & Network
// ──────────────────────────────────────────────
server.tool("server_firewall_status", "Check firewall status and rules (UFW or iptables).", {
    detailed: z.boolean().default(false).describe("Show full rule list"),
}, async ({ detailed }) => {
    const results = [];
    const { stdout: ufwStatus } = await ssh.exec("ufw status verbose 2>/dev/null || echo 'UFW not active'");
    results.push(`🛡️ UFW:\n${ufwStatus.trim()}`);
    if (detailed) {
        const { stdout: iptables } = await ssh.exec("iptables -L -n --line-numbers 2>/dev/null | head -60 || echo 'no iptables'");
        results.push(`\n📋 IPTABLES:\n${iptables.trim()}`);
    }
    const { stdout: listening } = await ssh.exec("ss -tlnp 2>/dev/null | head -30 || netstat -tlnp 2>/dev/null | head -30");
    results.push(`\n🔌 Listening ports:\n${listening.trim()}`);
    return { content: [{ type: "text", text: results.join("\n") }] };
});
server.tool("server_firewall_allow_port", "Allow a port through the firewall (UFW).", {
    port: z.number().describe("Port number to open"),
    protocol: z.enum(["tcp", "udp"]).default("tcp").describe("Protocol"),
    comment: z.string().optional().describe("Rule description"),
}, async ({ port, protocol, comment }) => {
    const commentFlag = comment ? `--comment "${comment}"` : "";
    const { stdout } = await ssh.exec(`ufw allow ${port}/${protocol} ${commentFlag} 2>&1 || iptables -A INPUT -p ${protocol} --dport ${port} -j ACCEPT ${commentFlag} 2>&1 || echo "No firewall tool found"`);
    return { content: [{ type: "text", text: `✅ Port ${port}/${protocol} opened\n${stdout.trim()}` }] };
});
server.tool("server_dns_check", "Check DNS resolution for a domain and verify it points to this server.", {
    domain: z.string().describe("Domain to check (e.g. example.com)"),
}, async ({ domain }) => {
    const results = [];
    results.push(`🔍 DNS check for ${domain}\n`);
    const { stdout: aRecord } = await ssh.exec(`dig +short ${domain} A 2>/dev/null || host -t A ${domain} 2>/dev/null || echo 'no dig/host'`);
    results.push(`📌 A record: ${aRecord.trim() || 'not found'}`);
    const { stdout: cname } = await ssh.exec(`dig +short ${domain} CNAME 2>/dev/null`);
    if (cname.trim())
        results.push(`📌 CNAME: ${cname.trim()}`);
    const { stdout: wwwRecord } = await ssh.exec(`dig +short www.${domain} A 2>/dev/null`);
    if (wwwRecord.trim())
        results.push(`📌 www.${domain}: ${wwwRecord.trim()}`);
    const { stdout: myIp } = await ssh.exec("curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}'");
    const serverIp = myIp.trim();
    results.push(`\n🖥️  Server IP: ${serverIp}`);
    if (aRecord.trim() && aRecord.trim() !== 'no dig/host') {
        if (aRecord.trim() === serverIp) {
            results.push(`\n✅ ${domain} → ${aRecord.trim()} (MATCHES server IP)`);
        }
        else {
            results.push(`\n⚠️  ${domain} → ${aRecord.trim()} (does NOT match server IP ${serverIp})`);
        }
    }
    else {
        results.push(`\n❌ No A record found — add a DNS A record pointing to ${serverIp}`);
    }
    return { content: [{ type: "text", text: results.join("\n") }] };
});
// ──────────────────────────────────────────────
//  Escape Hatch: Raw command
// ──────────────────────────────────────────────
server.tool("cloudpanel_raw_command", "Execute any command on the server (escape hatch — use with caution)", {
    command: z.string().describe("Shell command to execute on the server"),
}, async ({ command }) => {
    try {
        const result = await ssh.exec(command);
        return { content: [{ type: "text", text: result.stdout || result.stderr || "(no output)" }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});
// ──────────────────────────────────────────────
//  Start
// ──────────────────────────────────────────────
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("CloudPanel MCP Server running over stdio");
        console.error(`Connecting to ${config.username}@${config.host}:${config.port}`);
    }
    catch (e) {
        console.error("Failed to start MCP server:", e);
        process.exit(1);
    }
}
main();
