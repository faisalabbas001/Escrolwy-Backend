import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AlertsService } from '../alerts';
import { ReportingEventProducer } from '../kafka/reporting-event.producer';
import { WalletBalanceResponse } from './dto';

/**
 * Hot Wallet Balance Monitor
 *
 * Monitors hot wallet balance every 3 hours.
 * Calls admin service S2S API and generates alerts if balance < 5000.
 */
@Injectable()
export class HotWalletMonitor {
    private readonly logger = new Logger(HotWalletMonitor.name);

    private readonly WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:3004';
    private readonly WALLET_BALANCE_ALERT_THRESHOLD = Number(process.env.WALLET_BALANCE_ALERT_THRESHOLD) || 5000;

    // Endpoints
    private readonly walletBalancesEndpoint = '/api/v1/wallets/platform/balances';

    // Track last alert to avoid spam
    private lastAlertTime: Date | null = null;
    private readonly ALERT_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours

    constructor(
        private readonly httpService: HttpService,
        private readonly alertsService: AlertsService,
        private readonly reportingEventProducer: ReportingEventProducer,
    ) { }

    /**
     * Cron job: Check wallet balances every 3 hours
     */
    @Cron('0 */3 * * *') // Every 3 hours at minute 0
    async checkHotWalletBalance(): Promise<void> {
        this.logger.log('Starting wallet balance check...');

        try {
            // 1. Fetch Wallet Balances (Direct Access)
            const walletData = await this.getWalletBalances();

            // 2. Evaluate Balances
            await this.evaluateBalances(walletData);

        } catch (error: any) {
            this.logger.error(`Failed to check wallet balances: ${error.message}`);
            // Create alert for failed check
            await this.createBalanceCheckFailedAlert(error.message);
        }
    }



    /**
     * Fetch wallet balances from Wallet Service (Direct Access)
     */
    private async getWalletBalances(): Promise<WalletBalanceResponse> {
        const url = `${this.WALLET_SERVICE_URL}${this.walletBalancesEndpoint}`;

        try {
            const response = await firstValueFrom(
                this.httpService.get<WalletBalanceResponse>(url, {
                    timeout: 10000,
                })
            );
            return response.data;
        } catch (error: any) {
            this.logger.error(`Failed to fetch wallet balances: ${error.message}`);
            throw new Error(`Wallet API Failed: ${error.message}`);
        }
    }

    /**
     * Evaluate balances against threshold
     */
    private async evaluateBalances(data: WalletBalanceResponse): Promise<void> {
        const threshold = this.WALLET_BALANCE_ALERT_THRESHOLD;
        const alerts: Promise<void>[] = [];

        // 1. Check Hot Wallet (Native & Tokens)
        if (data.hot && data.hot.chains) {
            for (const chain of data.hot.chains) {
                // Check Native
                const nativeBalance = parseFloat(chain.nativeBalance);
                if (nativeBalance < threshold) {
                    alerts.push(this.createLowBalanceAlert('hot', chain.chain, chain.nativeSymbol, nativeBalance, threshold));
                }

                // Check Tokens
                if (chain.tokens) {
                    for (const token of chain.tokens) {
                        const tokenBalance = parseFloat(token.balance);
                        if (tokenBalance < threshold) {
                            alerts.push(this.createLowBalanceAlert('hot', chain.chain, token.symbol, tokenBalance, threshold));
                        }
                    }
                }
            }
        }

        // 2. Check Funding Wallet (Native Only)
        if (data.funding && data.funding.chains) {
            for (const chain of data.funding.chains) {
                // Check Native
                const nativeBalance = parseFloat(chain.nativeBalance);
                if (nativeBalance < threshold) {
                    alerts.push(this.createLowBalanceAlert('funding', chain.chain, chain.nativeSymbol, nativeBalance, threshold));
                }
            }
        }

        await Promise.all(alerts);
        this.logger.log(`Wallet balance check completed. Evaluated against threshold: ${threshold}`);
    }

    /**
     * Create alert for low balance
     */
    private async createLowBalanceAlert(
        walletType: string,
        chain: string,
        asset: string,
        balance: number,
        threshold: number
    ): Promise<void> {

        // Simple cooldown check - this limits ALL alerts from this service, which might be too aggressive
        // ideally we track per asset, but for now maintaining existing pattern or slightly improved 
        // to check strictly against "lastAlertTime" which is global for the service.
        // User requirements say "monitor... generate alerts". 
        // We really should allow multiple alerts if multiple assets are low.
        // I will remove the global cooldown blocking logic for INDIVIDUAL keys, 
        // relying on the cron schedule (3h) as the natural cooldown.

        try {
            const alert = await this.alertsService.createAlert({
                alertType: `LOW_WALLET_BALANCE`,
                source: 'wallet-monitor',
                severity: 'CRITICAL',
                description: `${walletType.toUpperCase()} wallet ${asset} balance on ${chain.toUpperCase()} is low: ${balance} (threshold: ${threshold})`,
                metadata: {
                    walletType,
                    chain,
                    asset,
                    currentBalance: balance,
                    threshold,
                    deficit: threshold - balance,
                    timestamp: new Date().toISOString(),
                },
            });

            // Publish alert event
            await this.reportingEventProducer.alertTriggered(
                alert.id,
                alert.alertType,
                alert.source,
                alert.severity,
                alert.description,
            );

            this.logger.warn(`Low balance alert created: ${walletType} ${asset} on ${chain} (${balance} < ${threshold})`);
        } catch (error: any) {
            this.logger.error(`Failed to create low balance alert: ${error.message}`);
        }
    }

    /**
     * Create alert for failed balance check
     */
    private async createBalanceCheckFailedAlert(errorMessage: string): Promise<void> {
        try {
            const alert = await this.alertsService.createAlert({
                alertType: 'WALLET_MONITOR_FAILED',
                source: 'wallet-monitor',
                severity: 'HIGH',
                description: `Failed to check wallet balances: ${errorMessage}`,
                metadata: {
                    error: errorMessage,
                    timestamp: new Date().toISOString(),
                },
            });

            // Publish alert event
            await this.reportingEventProducer.alertTriggered(
                alert.id,
                alert.alertType,
                alert.source,
                alert.severity,
                alert.description,
            );

            this.logger.warn('Balance check failed alert created');
        } catch (error: any) {
            this.logger.error(`Failed to create balance check alert: ${error.message}`);
        }
    }
}
