export interface ServiceConfig {
    name: string;
    port: number;
    healthPath: string;
}

export interface ServiceHealthStatus {
    serviceName: string;
    status: 'UP' | 'DOWN';
    lastChecked: string;
    failureReason?: string;
}

export interface HotWalletBalanceResponse {
    balance: number;
    currency: string;
    lastUpdated: string;
}
