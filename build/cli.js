#!/usr/bin/env node
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const SERVER_PATH = path.join(PROJECT_ROOT, "build", "index.js");
const PKG_NAME = "cloudpanel-mcp";
const HOST = process.env.CP_HOST || "your-server.com";
function makeServerBlock() {
    return {
        command: "npx",
        args: ["-y", PKG_NAME],
        env: {
            CP_USER: "root",
            CP_SSH_KEY: path.join(os.homedir(), ".ssh", "id_ed25519"),
            CP_HOST: HOST,
        },
    };
}
const PLATFORMS = [
    {
        name: "OpenCode",
        detect: () => fs.existsSync(path.join(os.homedir(), ".config", "opencode", "opencode.jsonc")),
        configPath: () => path.join(os.homedir(), ".config", "opencode", "opencode.jsonc"),
        readConfig: () => {
            const p = path.join(os.homedir(), ".config", "opencode", "opencode.jsonc");
            if (!fs.existsSync(p))
                return {};
            const raw = fs.readFileSync(p, "utf-8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
            try {
                return JSON.parse(raw);
            }
            catch {
                return {};
            }
        },
        writeConfig: (cfg) => {
            const p = path.join(os.homedir(), ".config", "opencode", "opencode.jsonc");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcp",
        isNested: true,
    },
    {
        name: "Claude Desktop",
        detect: () => {
            const paths = [
                path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"),
                path.join(os.homedir(), ".config", "claude", "claude_desktop_config.json"),
                path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
            ];
            return paths.some(p => fs.existsSync(p));
        },
        configPath: () => {
            const paths = [
                path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"),
                path.join(os.homedir(), ".config", "claude", "claude_desktop_config.json"),
                path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
            ];
            return paths.find(p => fs.existsSync(p)) || paths[0];
        },
        readConfig: () => {
            for (const p of [
                path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"),
                path.join(os.homedir(), ".config", "claude", "claude_desktop_config.json"),
                path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
            ]) {
                if (fs.existsSync(p))
                    try {
                        return JSON.parse(fs.readFileSync(p, "utf-8"));
                    }
                    catch { }
            }
            return {};
        },
        writeConfig: (cfg) => {
            const paths = [
                path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"),
                path.join(os.homedir(), ".config", "claude", "claude_desktop_config.json"),
                path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
            ];
            const p = paths.find(p => fs.existsSync(p)) || paths[1];
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "Cursor",
        detect: () => [path.join(os.homedir(), ".cursor", "mcp.json"), path.join(process.cwd(), ".cursor", "mcp.json")].some(p => fs.existsSync(p)),
        configPath: () => {
            const local = path.join(process.cwd(), ".cursor", "mcp.json");
            return fs.existsSync(local) ? local : path.join(os.homedir(), ".cursor", "mcp.json");
        },
        readConfig: () => {
            for (const p of [path.join(process.cwd(), ".cursor", "mcp.json"), path.join(os.homedir(), ".cursor", "mcp.json")]) {
                if (fs.existsSync(p))
                    try {
                        return JSON.parse(fs.readFileSync(p, "utf-8"));
                    }
                    catch { }
            }
            return {};
        },
        writeConfig: (cfg) => {
            const p = path.join(os.homedir(), ".cursor", "mcp.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "Windsurf",
        detect: () => {
            const paths = [path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"), path.join(process.cwd(), ".windsurf", "mcp_config.json")];
            return paths.some(p => fs.existsSync(p));
        },
        configPath: () => {
            const local = path.join(process.cwd(), ".windsurf", "mcp_config.json");
            return fs.existsSync(local) ? local : path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
        },
        readConfig: () => {
            for (const p of [path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"), path.join(process.cwd(), ".windsurf", "mcp_config.json")]) {
                if (fs.existsSync(p))
                    try {
                        return JSON.parse(fs.readFileSync(p, "utf-8"));
                    }
                    catch { }
            }
            return {};
        },
        writeConfig: (cfg) => {
            const p = path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "Cline",
        detect: () => fs.existsSync(path.join(os.homedir(), ".config", "cline", "mcp_settings.json")),
        configPath: () => path.join(os.homedir(), ".config", "cline", "mcp_settings.json"),
        readConfig: () => {
            const p = path.join(os.homedir(), ".config", "cline", "mcp_settings.json");
            if (!fs.existsSync(p))
                return {};
            try {
                return JSON.parse(fs.readFileSync(p, "utf-8"));
            }
            catch {
                return {};
            }
        },
        writeConfig: (cfg) => {
            const p = path.join(os.homedir(), ".config", "cline", "mcp_settings.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "Gemini CLI",
        detect: () => fs.existsSync(path.join(os.homedir(), ".config", "gemini", "config.json")),
        configPath: () => path.join(os.homedir(), ".config", "gemini", "config.json"),
        readConfig: () => {
            const p = path.join(os.homedir(), ".config", "gemini", "config.json");
            if (!fs.existsSync(p))
                return {};
            try {
                return JSON.parse(fs.readFileSync(p, "utf-8"));
            }
            catch {
                return {};
            }
        },
        writeConfig: (cfg) => {
            const p = path.join(os.homedir(), ".config", "gemini", "config.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "Kiro",
        detect: () => [path.join(os.homedir(), ".kiro", "config.json"), path.join(os.homedir(), ".config", "kiro", "config.json")].some(p => fs.existsSync(p)),
        configPath: () => path.join(os.homedir(), ".kiro", "config.json"),
        readConfig: () => {
            for (const p of [path.join(os.homedir(), ".kiro", "config.json"), path.join(os.homedir(), ".config", "kiro", "config.json")]) {
                if (fs.existsSync(p))
                    try {
                        return JSON.parse(fs.readFileSync(p, "utf-8"));
                    }
                    catch { }
            }
            return {};
        },
        writeConfig: (cfg) => {
            const p = path.join(os.homedir(), ".config", "kiro", "config.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "Continue (VS Code)",
        detect: () => fs.existsSync(path.join(os.homedir(), ".continue", "config.json")),
        configPath: () => path.join(os.homedir(), ".continue", "config.json"),
        readConfig: () => {
            const p = path.join(os.homedir(), ".continue", "config.json");
            if (!fs.existsSync(p))
                return {};
            try {
                return JSON.parse(fs.readFileSync(p, "utf-8"));
            }
            catch {
                return {};
            }
        },
        writeConfig: (cfg) => {
            const p = path.join(os.homedir(), ".continue", "config.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "Claude Code (global)",
        detect: () => fs.existsSync(path.join(os.homedir(), ".claude", "settings.json")),
        configPath: () => path.join(os.homedir(), ".claude", "settings.json"),
        readConfig: () => {
            const p = path.join(os.homedir(), ".claude", "settings.json");
            if (!fs.existsSync(p))
                return {};
            try {
                return JSON.parse(fs.readFileSync(p, "utf-8"));
            }
            catch {
                return {};
            }
        },
        writeConfig: (cfg) => {
            const p = path.join(os.homedir(), ".claude", "settings.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "Claude Code (local)",
        detect: () => fs.existsSync(path.join(process.cwd(), ".claude", "settings.local.json")),
        configPath: () => path.join(process.cwd(), ".claude", "settings.local.json"),
        readConfig: () => {
            const p = path.join(process.cwd(), ".claude", "settings.local.json");
            if (!fs.existsSync(p))
                return {};
            try {
                return JSON.parse(fs.readFileSync(p, "utf-8"));
            }
            catch {
                return {};
            }
        },
        writeConfig: (cfg) => {
            const p = path.join(process.cwd(), ".claude", "settings.local.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "VS Code MCP",
        detect: () => fs.existsSync(path.join(process.cwd(), ".vscode", "mcp.json")),
        configPath: () => path.join(process.cwd(), ".vscode", "mcp.json"),
        readConfig: () => {
            const p = path.join(process.cwd(), ".vscode", "mcp.json");
            if (!fs.existsSync(p))
                return {};
            try {
                return JSON.parse(fs.readFileSync(p, "utf-8"));
            }
            catch {
                return {};
            }
        },
        writeConfig: (cfg) => {
            const p = path.join(process.cwd(), ".vscode", "mcp.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
    {
        name: "Codex CLI",
        detect: () => [path.join(os.homedir(), ".codex", "config.json"), path.join(process.cwd(), ".codex", "config.json")].some(p => fs.existsSync(p)),
        configPath: () => {
            const local = path.join(process.cwd(), ".codex", "config.json");
            return fs.existsSync(local) ? local : path.join(os.homedir(), ".codex", "config.json");
        },
        readConfig: () => {
            for (const p of [path.join(process.cwd(), ".codex", "config.json"), path.join(os.homedir(), ".codex", "config.json")]) {
                if (fs.existsSync(p))
                    try {
                        return JSON.parse(fs.readFileSync(p, "utf-8"));
                    }
                    catch { }
            }
            return {};
        },
        writeConfig: (cfg) => {
            const p = path.join(os.homedir(), ".codex", "config.json");
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        },
        mergeKey: "mcpServers",
        isNested: false,
    },
];
function cmdInstall(args) {
    const onlyPlatforms = args.filter(a => a.startsWith("--")).map(a => a.replace("--", "").toLowerCase());
    console.log(`
╔══════════════════════════════════════════════╗
║  CloudPanel MCP Server — Installer          ║
║  48 tools · Sites · Docker · SSL · Deploy   ║
╚══════════════════════════════════════════════╝
`);
    let installed = 0;
    let found = 0;
    for (const platform of PLATFORMS) {
        const name = platform.name.toLowerCase().replace(/\s+/g, "-");
        if (onlyPlatforms.length > 0 && !onlyPlatforms.some(p => name.includes(p)))
            continue;
        const detected = platform.detect();
        if (!detected) {
            console.log(`  ⬜ ${platform.name.padEnd(22)} not detected`);
            continue;
        }
        found++;
        try {
            const config = platform.readConfig();
            const block = makeServerBlock();
            if (platform.isNested) {
                if (!config[platform.mergeKey])
                    config[platform.mergeKey] = {};
                config[platform.mergeKey].cloudpanel = {
                    type: "local",
                    command: ["npx", "-y", PKG_NAME],
                    env: block.env,
                };
            }
            else {
                if (!config[platform.mergeKey])
                    config[platform.mergeKey] = {};
                config[platform.mergeKey].cloudpanel = block;
            }
            platform.writeConfig(config);
            console.log(`  ✅ ${platform.name.padEnd(22)} configured → ${platform.configPath()}`);
            installed++;
        }
        catch (e) {
            console.log(`  ❌ ${platform.name.padEnd(22)} ${e.message}`);
        }
    }
    if (found === 0) {
        console.log(`\n  ⚠️  No supported AI tools detected.`);
        console.log(`  Install manually — see docs for config details.\n`);
    }
    console.log(`
  ─────────────────────────────────────────────
  ✅ ${installed}/${found} platforms configured
  🔑 SSH key: ${path.join(os.homedir(), ".ssh", "id_ed25519")}
  🌐 Server:   ${HOST} (set CP_HOST env to change)

  Before connecting, copy your SSH key:
    ssh-copy-id root@${HOST}

  Then restart your AI tool and ask:
    "list my cloudpanel sites"
`);
}
function cmdHelp() {
    console.log(`
CloudPanel MCP Server v2 — 48 tools

USAGE
  npx ${PKG_NAME}               Start MCP server (stdio)
  npx ${PKG_NAME} install       Auto-install for all detected AI tools
  npx ${PKG_NAME} install --cursor --opencode
  npx ${PKG_NAME} help          Show this help

ENV VARIABLES
  CP_HOST       Server hostname/IP     (default: your-server.com)
  CP_USER       SSH user               (default: root)
  CP_SSH_KEY    Path to SSH key        (default: ~/.ssh/id_ed25519)
  CP_PASSWORD   SSH password fallback
  CP_SSH_PORT   SSH port               (default: 22)

PLATFORMS
  OpenCode · Claude Desktop · Cursor · Windsurf
  Cline · Gemini CLI · Kiro · Continue (VS Code)
  Claude Code · VS Code MCP · Codex CLI

50 TOOLS
  cloudpanel_*  (26)  Sites · SSL · Databases · System · Users · Backups
  docker_*      (10)  Containers · Compose · Logs · Exec · Images · Login · Prune
  server_*      (8)   Install Docker/Postgres/Node/Nginx/Certbot/Redis/MySQL
  deploy        (1)   deploy_project — one-shot deploy with method=docker|cloudpanel
  server_*      (3)   Firewall status · Allow port · DNS check
  raw           (1)   cloudpanel_raw_command — escape hatch

AUTH
  SSH key (default):     Set CP_SSH_KEY=/path/to/key
  Username + password:   Set CP_USER=root CP_PASSWORD=yourpass
  Docker registry:       Use docker_login tool with username+token

EXAMPLES
  Deploy a site:     cloudpanel_create_python_site domainName=app.mysite.com pythonVersion=3.12
  Check server:      server_software_status detailed=true
  Install Docker:    server_install_docker dryRun=true
  Deploy stack:      deploy_project method=docker autoSsl=true
  Docker login:      docker_login username=myuser password=mytoken
`);
}
async function main() {
    const args = process.argv.slice(2);
    if (args[0] === "install") {
        cmdInstall(args.slice(1));
        return;
    }
    if (args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
        cmdHelp();
        return;
    }
    if (args[0] === "start" || args[0] === "serve" || args.length === 0) {
        if (!fs.existsSync(SERVER_PATH)) {
            console.error("Build not found. Run: npm run build");
            process.exit(1);
        }
        const proc = spawn("node", [SERVER_PATH], {
            stdio: "inherit",
            env: process.env,
        });
        proc.on("exit", (code) => process.exit(code ?? 0));
        return;
    }
    console.error(`Unknown: ${args[0]}`);
    cmdHelp();
    process.exit(1);
}
main().catch(console.error);
