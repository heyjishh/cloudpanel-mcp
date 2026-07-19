import { Client } from "ssh2";
export class SSHClient {
    config;
    conn = null;
    ready = false;
    reconnectTimer = null;
    commandQueue = [];
    connecting = false;
    retries = 0;
    maxRetries = 5;
    constructor(config) {
        this.config = config;
    }
    async connect() {
        if (this.ready)
            return;
        if (this.connecting) {
            return new Promise((resolve) => {
                const check = () => {
                    if (this.ready)
                        resolve();
                    else
                        setTimeout(check, 100);
                };
                check();
            });
        }
        this.connecting = true;
        return new Promise((resolve, reject) => {
            const conn = new Client();
            const connectConfig = {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                readyTimeout: 15000,
                keepaliveInterval: 10000,
                keepaliveCountMax: 3,
            };
            if (this.config.privateKey) {
                connectConfig.privateKey = this.config.privateKey;
            }
            else if (this.config.password) {
                connectConfig.password = this.config.password;
            }
            conn.on("ready", () => {
                this.conn = conn;
                this.ready = true;
                this.connecting = false;
                this.retries = 0;
                this.drainQueue();
                resolve();
            });
            conn.on("error", (err) => {
                console.error(`SSH error: ${err.message}`);
                this.handleDisconnect();
                if (!this.ready) {
                    this.connecting = false;
                    reject(err);
                }
            });
            conn.on("close", () => {
                this.handleDisconnect();
            });
            conn.on("end", () => {
                this.handleDisconnect();
            });
            conn.connect(connectConfig);
        });
    }
    handleDisconnect() {
        this.ready = false;
        this.conn = null;
        this.connecting = false;
        this.scheduleReconnect();
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        const delay = Math.min(1000 * Math.pow(2, this.retries), 30000);
        this.retries++;
        if (this.retries > this.maxRetries) {
            console.error("Max SSH reconnect retries reached");
            return;
        }
        console.error(`Reconnecting in ${delay}ms (attempt ${this.retries}/${this.maxRetries})`);
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            try {
                await this.connect();
            }
            catch {
                // reconnect will be retried via handleDisconnect
            }
        }, delay);
    }
    drainQueue() {
        const queue = [...this.commandQueue];
        this.commandQueue = [];
        for (const item of queue) {
            this.execRaw(item.cmd).then(item.resolve).catch(item.reject);
        }
    }
    async execRaw(cmd) {
        if (!this.conn || !this.ready) {
            throw new Error("Not connected");
        }
        return new Promise((resolve, reject) => {
            this.conn.exec(cmd, (err, stream) => {
                if (err)
                    return reject(err);
                let stdout = "";
                let stderr = "";
                stream
                    .on("close", (code) => {
                    resolve({ stdout, stderr, code });
                })
                    .on("data", (data) => {
                    stdout += data.toString();
                })
                    .stderr.on("data", (data) => {
                    stderr += data.toString();
                });
            });
        });
    }
    async exec(command) {
        try {
            await this.connect();
            return await this.execRaw(command);
        }
        catch (err) {
            if (this.commandQueue.length < 10) {
                return new Promise((resolve, reject) => {
                    this.commandQueue.push({ cmd: command, resolve, reject });
                });
            }
            throw err;
        }
    }
    async runClpctl(args) {
        return this.exec(`clpctl ${args} 2>&1`);
    }
    async checkClpctl() {
        try {
            const result = await this.exec("which clpctl && clpctl --version 2>/dev/null || echo 'NOT_FOUND'");
            return !result.stdout.includes("NOT_FOUND") && result.code === 0;
        }
        catch {
            return false;
        }
    }
    async checkDocker() {
        try {
            const result = await this.exec("which docker && docker --version 2>/dev/null || echo 'NOT_FOUND'");
            return !result.stdout.includes("NOT_FOUND");
        }
        catch {
            return false;
        }
    }
    async listSites() {
        const { stdout } = await this.exec("clpctl site:list 2>/dev/null || ls /etc/nginx/sites-enabled/ 2>/dev/null || echo 'NO_SITES'");
        const lines = stdout.trim().split("\n").filter((l) => l.trim());
        return lines.map((line) => ({ name: line.trim() }));
    }
    async getSystemInfo() {
        const [osInfo, memInfo, diskInfo, uptime, cpVersion, dockerVersion] = await Promise.all([
            this.exec("cat /etc/os-release | head -5"),
            this.exec("free -h | grep Mem"),
            this.exec("df -h / | tail -1"),
            this.exec("uptime -p"),
            this.exec("clpctl --version 2>/dev/null || echo 'unknown'"),
            this.exec("docker info --format '{{.ServerVersion}}' 2>/dev/null || echo 'not installed'"),
        ]);
        return {
            osInfo: osInfo.stdout.trim(),
            memory: memInfo.stdout.trim(),
            disk: diskInfo.stdout.trim(),
            uptime: uptime.stdout.trim(),
            cloudpanelVersion: cpVersion.stdout.trim(),
            dockerVersion: dockerVersion.stdout.trim(),
        };
    }
    async executeRawCommand(command) {
        return this.exec(command);
    }
    async disconnect() {
        if (this.conn) {
            this.conn.end();
            this.conn = null;
        }
        this.ready = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
