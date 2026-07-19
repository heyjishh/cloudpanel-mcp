export interface SSHConfig {
    host: string;
    port: number;
    username: string;
    privateKey?: string;
    password?: string;
}
export declare class SSHClient {
    private config;
    private conn;
    private ready;
    private reconnectTimer;
    private commandQueue;
    private connecting;
    private retries;
    private maxRetries;
    constructor(config: SSHConfig);
    private connect;
    private handleDisconnect;
    private scheduleReconnect;
    private drainQueue;
    private execRaw;
    exec(command: string): Promise<{
        stdout: string;
        stderr: string;
        code: number | null;
    }>;
    runClpctl(args: string): Promise<{
        stdout: string;
        stderr: string;
        code: number | null;
    }>;
    checkClpctl(): Promise<boolean>;
    checkDocker(): Promise<boolean>;
    listSites(): Promise<any[]>;
    getSystemInfo(): Promise<any>;
    executeRawCommand(command: string): Promise<{
        stdout: string;
        stderr: string;
        code: number | null;
    }>;
    disconnect(): Promise<void>;
}
