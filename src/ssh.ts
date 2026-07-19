import { Client, ConnectConfig } from "ssh2";

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
}

export class SSHClient {
  private config: SSHConfig;
  private conn: Client | null = null;
  private ready = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private commandQueue: Array<{
    cmd: string;
    resolve: (v: { stdout: string; stderr: string; code: number | null }) => void;
    reject: (e: Error) => void;
  }> = [];
  private connecting = false;
  private retries = 0;
  private maxRetries = 5;

  constructor(config: SSHConfig) {
    this.config = config;
  }

  private async connect(): Promise<void> {
    if (this.ready) return;
    if (this.connecting) {
      return new Promise((resolve) => {
        const check = () => {
          if (this.ready) resolve();
          else setTimeout(check, 100);
        };
        check();
      });
    }

    this.connecting = true;
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const connectConfig: ConnectConfig = {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        readyTimeout: 15000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
      };

      if (this.config.privateKey) {
        connectConfig.privateKey = this.config.privateKey;
      } else if (this.config.password) {
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

  private handleDisconnect() {
    this.ready = false;
    this.conn = null;
    this.connecting = false;
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
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
      } catch {
        // reconnect will be retried via handleDisconnect
      }
    }, delay);
  }

  private drainQueue() {
    const queue = [...this.commandQueue];
    this.commandQueue = [];
    for (const item of queue) {
      this.execRaw(item.cmd).then(item.resolve).catch(item.reject);
    }
  }

  private async execRaw(cmd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    if (!this.conn || !this.ready) {
      throw new Error("Not connected");
    }

    return new Promise((resolve, reject) => {
      this.conn!.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        let stdout = "";
        let stderr = "";
        stream
          .on("close", (code: number | null) => {
            resolve({ stdout, stderr, code });
          })
          .on("data", (data: Buffer) => {
            stdout += data.toString();
          })
          .stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });
      });
    });
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    try {
      await this.connect();
      return await this.execRaw(command);
    } catch (err: any) {
      if (this.commandQueue.length < 10) {
        return new Promise((resolve, reject) => {
          this.commandQueue.push({ cmd: command, resolve, reject });
        });
      }
      throw err;
    }
  }

  async runClpctl(args: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return this.exec(`clpctl ${args} 2>&1`);
  }

  async checkClpctl(): Promise<boolean> {
    try {
      const result = await this.exec("which clpctl && clpctl --version 2>/dev/null || echo 'NOT_FOUND'");
      return !result.stdout.includes("NOT_FOUND") && result.code === 0;
    } catch {
      return false;
    }
  }

  async checkDocker(): Promise<boolean> {
    try {
      const result = await this.exec("which docker && docker --version 2>/dev/null || echo 'NOT_FOUND'");
      return !result.stdout.includes("NOT_FOUND");
    } catch {
      return false;
    }
  }

  async listSites(): Promise<any[]> {
    const { stdout } = await this.exec("clpctl site:list 2>/dev/null || ls /etc/nginx/sites-enabled/ 2>/dev/null || echo 'NO_SITES'");
    const lines = stdout.trim().split("\n").filter((l: string) => l.trim());
    return lines.map((line: string) => ({ name: line.trim() }));
  }

  async getSystemInfo(): Promise<any> {
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

  async executeRawCommand(command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return this.exec(command);
  }

  async disconnect(): Promise<void> {
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
