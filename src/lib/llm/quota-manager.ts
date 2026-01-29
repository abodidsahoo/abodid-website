/**
 * Quota Manager
 * 
 * Enforces OpenRouter free-tier limits:
 * - 20 requests/minute for free variants
 * - 50/day (< 10 credits) or 1000/day (≥ 10 credits)
 * 
 * Uses in-memory storage for simplicity (can be swapped with Redis for production)
 */

import type { QuotaStatus, QuotaConfig } from './types';

export class QuotaManager {
    private config: QuotaConfig;

    // In-memory counters (replace with Redis for production)
    private minuteCounter: Map<number, number> = new Map();
    private dailyCounter: Map<string, number> = new Map();

    constructor(config: QuotaConfig) {
        this.config = config;
    }

    /**
     * Get current minute window key
     */
    private getCurrentMinuteKey(): number {
        return Math.floor(Date.now() / 60000); // Minutes since epoch
    }

    /**
     * Get current day key (UTC)
     */
    private getCurrentDayKey(): string {
        const now = new Date();
        return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    }

    /**
     * Clean up old minute counters (keep last 2 minutes)
     */
    private cleanupOldMinutes(): void {
        const currentMinute = this.getCurrentMinuteKey();
        const keysToDelete: number[] = [];

        for (const key of this.minuteCounter.keys()) {
            if (key < currentMinute - 1) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach((key) => this.minuteCounter.delete(key));
    }

    /**
     * Clean up old daily counters (keep last 2 days)
     */
    private cleanupOldDays(): void {
        const currentDay = this.getCurrentDayKey();
        const keysToDelete: string[] = [];

        for (const key of this.dailyCounter.keys()) {
            if (key < currentDay) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach((key) => this.dailyCounter.delete(key));
    }

    /**
     * Get current quota status
     */
    async getStatus(): Promise<QuotaStatus> {
        this.cleanupOldMinutes();
        this.cleanupOldDays();

        const currentMinute = this.getCurrentMinuteKey();
        const currentDay = this.getCurrentDayKey();

        const requestsThisMinute = this.minuteCounter.get(currentMinute) || 0;
        const requestsToday = this.dailyCounter.get(currentDay) || 0;

        const available =
            requestsThisMinute < this.config.rpm_limit &&
            requestsToday < this.config.rpd_limit;

        // Calculate time until minute reset
        const nowMs = Date.now();
        const currentMinuteStartMs = currentMinute * 60000;
        const nextMinuteStartMs = (currentMinute + 1) * 60000;
        const resetInMs = nextMinuteStartMs - nowMs;

        return {
            requests_this_minute: requestsThisMinute,
            requests_today: requestsToday,
            max_rpm: this.config.rpm_limit,
            max_rpd: this.config.rpd_limit,
            available,
            reset_in_ms: resetInMs,
        };
    }

    /**
     * Check if quota is available
     */
    async isAvailable(): Promise<boolean> {
        const status = await this.getStatus();
        return status.available;
    }

    /**
     * Record a request (increment counters)
     */
    async recordRequest(): Promise<void> {
        this.cleanupOldMinutes();
        this.cleanupOldDays();

        const currentMinute = this.getCurrentMinuteKey();
        const currentDay = this.getCurrentDayKey();

        // Increment minute counter
        const minuteCount = this.minuteCounter.get(currentMinute) || 0;
        this.minuteCounter.set(currentMinute, minuteCount + 1);

        // Increment daily counter
        const dayCount = this.dailyCounter.get(currentDay) || 0;
        this.dailyCounter.set(currentDay, dayCount + 1);
    }

    /**
     * Wait for quota to become available (with timeout)
     */
    async waitForQuota(timeoutMs: number = 5000): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            if (await this.isAvailable()) {
                return true;
            }

            // Get status to see how long until reset
            const status = await this.getStatus();

            // If daily quota exceeded, can't wait
            if (status.requests_today >= status.max_rpd) {
                return false;
            }

            // Wait until next minute (with some buffer)
            const waitMs = Math.min(status.reset_in_ms || 1000, timeoutMs - (Date.now() - startTime));
            if (waitMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }

        return false;
    }

    /**
     * Reset all counters (for testing)
     */
    reset(): void {
        this.minuteCounter.clear();
        this.dailyCounter.clear();
    }
}
