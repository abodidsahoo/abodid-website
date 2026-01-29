/**
 * LLM Service - Unified API Surface
 * 
 * Main entry point for all LLM operations.
 * Provides simple, task-agnostic interface for app consumption.
 */

import type { TaskRequest, TaskResponse, ExecutionResult, QuotaStatus } from './types';
import { OpenRouterClient } from './openrouter-client';
import { ModelCatalogService } from './model-catalog-service';
import { QuotaManager } from './quota-manager';
import { Telemetry } from './telemetry';
import { PolicyEngine } from './policy-engine';
import { Executor } from './executor';

export interface LLMServiceConfig {
    apiKey: string;
    siteUrl?: string;
    siteName?: string;
    catalogTTLMinutes?: number;
    quotaRPM?: number;
    quotaRPD?: number;
    allowPaidFallback?: boolean;
}

export class LLMService {
    private client: OpenRouterClient;
    private catalog: ModelCatalogService;
    private quota: QuotaManager;
    private telemetry: Telemetry;
    private policy: PolicyEngine;
    private executor: Executor;

    constructor(config: LLMServiceConfig) {
        // Initialize components
        this.client = new OpenRouterClient({
            apiKey: config.apiKey,
            siteUrl: config.siteUrl,
            siteName: config.siteName,
        });

        this.catalog = new ModelCatalogService(this.client, config.catalogTTLMinutes || 60);

        this.quota = new QuotaManager({
            rpm_limit: config.quotaRPM || 20,
            rpd_limit: config.quotaRPD || 1000,
        });

        this.telemetry = new Telemetry();

        this.policy = new PolicyEngine(this.catalog, this.telemetry, {
            allow_paid_fallback: config.allowPaidFallback || false,
        });

        this.executor = new Executor(
            this.client,
            this.policy,
            this.quota,
            this.telemetry,
            this.catalog
        );
    }

    /**
     * Execute an LLM task
     * Main method for all LLM operations
     */
    async execute(request: TaskRequest): Promise<TaskResponse> {
        const result = await this.executor.execute(request);

        if (!result.success || !result.response) {
            throw new Error(
                result.error?.message || 'LLM execution failed'
            );
        }

        return result.response;
    }

    /**
     * Simple chat completion (convenience method)
     */
    async chat(
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        options?: {
            temperature?: number;
            max_tokens?: number;
            allow_paid_fallback?: boolean;
        }
    ): Promise<string> {
        const response = await this.execute({
            messages,
            temperature: options?.temperature,
            max_tokens: options?.max_tokens,
            requirements: {
                allow_paid_fallback: options?.allow_paid_fallback,
            },
        });

        return response.message.content;
    }

    /**
     * JSON completion (convenience method)
     */
    async chatJSON<T = any>(
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        options?: {
            temperature?: number;
            max_tokens?: number;
            allow_paid_fallback?: boolean;
        }
    ): Promise<T> {
        const response = await this.execute({
            messages,
            temperature: options?.temperature,
            max_tokens: options?.max_tokens,
            response_format: { type: 'json_object' },
            requirements: {
                needs_json: true,
                allow_paid_fallback: options?.allow_paid_fallback,
            },
        });

        return JSON.parse(response.message.content);
    }

    /**
     * Get quota status
     */
    async getQuotaStatus(): Promise<QuotaStatus> {
        return await this.quota.getStatus();
    }

    /**
     * Get telemetry summary
     */
    getTelemetrySummary() {
        return this.telemetry.getSummary();
    }

    /**
     * Get all health scores
     */
    getHealthScores() {
        return this.telemetry.getAllHealthScores();
    }

    /**
     * Manually refresh model catalog
     */
    async refreshCatalog(): Promise<void> {
        await this.catalog.refresh();
    }

    /**
     * Get catalog stats
     */
    getCatalogStats() {
        return this.catalog.getCacheStats();
    }

    /**
     * Reset quota (for testing)
     */
    resetQuota(): void {
        this.quota.reset();
    }

    /**
     * Clear telemetry (for testing)
     */
    clearTelemetry(): void {
        this.telemetry.clear();
    }
}

/**
 * Create LLM service from environment variables
 */
export function createLLMService(overrides?: Partial<LLMServiceConfig>): LLMService {
    const config: LLMServiceConfig = {
        apiKey: import.meta.env.OPENROUTER_API_KEY,
        siteUrl: import.meta.env.PUBLIC_SITE_URL,
        siteName: import.meta.env.PUBLIC_SITE_NAME,
        ...overrides,
    };

    if (!config.apiKey) {
        throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    return new LLMService(config);
}
