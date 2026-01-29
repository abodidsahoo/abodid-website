/**
 * Executor
 * 
 * Orchestrates LLM task execution with:
 * - Retry logic with exponential backoff
 * - Intelligent failover to alternate models
 * - Error handling and telemetry
 */

import type {
    TaskRequest,
    TaskResponse,
    ExecutionConfig,
    ExecutionResult,
    OpenRouterChatCompletionRequest,
} from './types';
import { OpenRouterClient } from './openrouter-client';
import { PolicyEngine } from './policy-engine';
import { QuotaManager } from './quota-manager';
import { Telemetry } from './telemetry';
import { ModelCatalogService } from './model-catalog-service';

export class Executor {
    private client: OpenRouterClient;
    private policy: PolicyEngine;
    private quota: QuotaManager;
    private telemetry: Telemetry;
    private catalog: ModelCatalogService;
    private config: ExecutionConfig;

    constructor(
        client: OpenRouterClient,
        policy: PolicyEngine,
        quota: QuotaManager,
        telemetry: Telemetry,
        catalog: ModelCatalogService,
        config?: Partial<ExecutionConfig>
    ) {
        this.client = client;
        this.policy = policy;
        this.quota = quota;
        this.telemetry = telemetry;
        this.catalog = catalog;

        // Default config
        this.config = {
            max_failovers: config?.max_failovers ?? 3,
            max_total_time_ms: config?.max_total_time_ms ?? 60000,
            initial_backoff_ms: config?.initial_backoff_ms ?? 500,
            max_backoff_ms: config?.max_backoff_ms ?? 10000,
            request_timeout_ms: config?.request_timeout_ms ?? 60000,
        };
    }

    /**
     * Execute a task with retries and failover
     */
    async execute(taskRequest: TaskRequest): Promise<ExecutionResult> {
        const startTime = Date.now();
        const modelsTried: string[] = [];
        let attempts = 0;

        // Get routing candidates
        const quotaAvailable = await this.quota.isAvailable();
        const requirements = taskRequest.requirements || {};

        const candidates = await this.policy.getCandidates(requirements, quotaAvailable);

        if (candidates.length === 0) {
            return {
                success: false,
                error: {
                    message: 'No models available for this request',
                    code: 'NO_MODELS',
                    retriable: false,
                },
                attempts: 0,
                models_tried: [],
            };
        }

        // Try each candidate in order
        for (let i = 0; i < candidates.length && i < this.config.max_failovers; i++) {
            const candidate = candidates[i];
            const model = candidate.model;

            // Check timeout
            if (Date.now() - startTime > this.config.max_total_time_ms) {
                this.telemetry.log({
                    event_type: 'error',
                    model_id: model.id,
                    is_free: model.is_free,
                    error_code: 'TIMEOUT',
                    error_message: 'Total execution time exceeded',
                });
                break;
            }

            modelsTried.push(model.id);
            attempts++;

            // Check quota for free models
            if (model.is_free) {
                const quotaOk = await this.quota.isAvailable();
                if (!quotaOk) {
                    this.telemetry.log({
                        event_type: 'error',
                        model_id: model.id,
                        is_free: model.is_free,
                        error_code: 'QUOTA_EXCEEDED',
                        error_message: 'Free tier quota exceeded',
                    });

                    // Skip to paid models if available
                    continue;
                }

                // Record quota usage
                await this.quota.recordRequest();
            }

            // Try with retries
            const result = await this.executeWithRetries(taskRequest, model.id, model.is_free);

            if (result.success && result.response) {
                return result;
            }

            // Log failover
            if (i < candidates.length - 1) {
                this.telemetry.log({
                    event_type: 'fallback',
                    model_id: model.id,
                    is_free: model.is_free,
                    failover_count: i + 1,
                });
            }

            // Check if error is model not found -> refresh catalog
            if (result.error && OpenRouterClient.isInvalidModelError(result.error)) {
                await this.catalog.refresh();
            }
        }

        // All attempts failed
        return {
            success: false,
            error: {
                message: 'All model attempts failed',
                code: 'ALL_FAILED',
                retriable: false,
            },
            attempts,
            models_tried: modelsTried,
        };
    }

    /**
     * Execute with retries for a single model
     */
    private async executeWithRetries(
        taskRequest: TaskRequest,
        modelId: string,
        isFree: boolean,
        maxRetries: number = 3
    ): Promise<ExecutionResult> {
        let lastError: any;

        for (let retry = 0; retry < maxRetries; retry++) {
            try {
                const requestStart = Date.now();

                // Build OpenRouter request payload
                const payload: OpenRouterChatCompletionRequest = {
                    model: modelId,
                    messages: taskRequest.messages,
                    temperature: taskRequest.temperature,
                    top_p: taskRequest.top_p,
                    max_tokens: taskRequest.max_tokens,
                    response_format: taskRequest.response_format,
                    tools: taskRequest.tools,
                    tool_choice: taskRequest.tool_choice,
                };

                // Execute request
                const response = await this.client.chatCompletions(payload);
                const latency = Date.now() - requestStart;

                // Log success
                this.telemetry.log({
                    event_type: 'request',
                    model_id: modelId,
                    is_free: isFree,
                    latency_ms: latency,
                    request_chars: JSON.stringify(taskRequest.messages).length,
                    response_chars: response.choices[0]?.message?.content?.length || 0,
                });

                // Return success
                return {
                    success: true,
                    response: {
                        message: response.choices[0].message,
                        model_used: modelId,
                        is_free: isFree,
                        failover_count: 0,
                        latency_ms: latency,
                        usage: response.usage,
                    },
                    attempts: retry + 1,
                    models_tried: [modelId],
                };

            } catch (error: any) {
                lastError = error;

                // Log error
                this.telemetry.log({
                    event_type: 'error',
                    model_id: modelId,
                    is_free: isFree,
                    error_code: error.status || 'UNKNOWN',
                    error_message: error.message,
                });

                // Check if retriable
                if (!OpenRouterClient.isRetriableError(error)) {
                    // Non-retriable error, stop retrying this model
                    return {
                        success: false,
                        error: {
                            message: error.message,
                            code: error.status || 'UNKNOWN',
                            retriable: false,
                        },
                        attempts: retry + 1,
                        models_tried: [modelId],
                    };
                }

                // Wait before retry (exponential backoff with jitter)
                if (retry < maxRetries - 1) {
                    const backoff = this.calculateBackoff(retry);
                    await this.sleep(backoff);
                }
            }
        }

        // All retries exhausted
        return {
            success: false,
            error: {
                message: lastError?.message || 'Unknown error',
                code: lastError?.status || 'UNKNOWN',
                retriable: true,
            },
            attempts: maxRetries,
            models_tried: [modelId],
        };
    }

    /**
     * Calculate exponential backoff with jitter
     */
    private calculateBackoff(retryCount: number): number {
        const exponential = this.config.initial_backoff_ms * Math.pow(2, retryCount);
        const capped = Math.min(exponential, this.config.max_backoff_ms);
        const jitter = Math.random() * 0.3 * capped; // 30% jitter
        return capped + jitter;
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Update execution config
     */
    updateConfig(updates: Partial<ExecutionConfig>): void {
        this.config = { ...this.config, ...updates };
    }

    /**
     * Get current config
     */
    getConfig(): ExecutionConfig {
        return { ...this.config };
    }
}
