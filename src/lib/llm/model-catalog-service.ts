/**
 * Model Catalog Service
 * 
 * Caches OpenRouter model catalog with TTL-based refresh.
 * Provides fast queries for free/paid models with filtering.
 */

import type { OpenRouterModel, ModelMetadata, CatalogQuery } from './types';
import { OpenRouterClient } from './openrouter-client';

export class ModelCatalogService {
    private client: OpenRouterClient;
    private cache: ModelMetadata[] = [];
    private cacheTimestamp: number = 0;
    private ttlMs: number;

    constructor(client: OpenRouterClient, ttlMinutes: number = 60) {
        this.client = client;
        this.ttlMs = ttlMinutes * 60 * 1000;
    }

    /**
     * Check if cache is stale
     */
    private isCacheStale(): boolean {
        if (this.cache.length === 0) return true;
        return Date.now() - this.cacheTimestamp > this.ttlMs;
    }

    /**
     * Parse model provider from ID
     * e.g., "openai/gpt-4" -> "openai"
     */
    private extractProvider(modelId: string): string {
        const parts = modelId.split('/');
        return parts.length > 1 ? parts[0] : 'unknown';
    }

    /**
     * Convert OpenRouter model to internal metadata
     */
    private toMetadata(model: OpenRouterModel): ModelMetadata {
        const isFree = model.id.endsWith(':free');
        const contextLength = model.context_length || model.top_provider?.context_length || 0;

        // Parse pricing (stored as strings like "0.0001")
        const pricingPrompt = parseFloat(model.pricing?.prompt || '0');
        const pricingCompletion = parseFloat(model.pricing?.completion || '0');

        return {
            id: model.id,
            name: model.name,
            is_free: isFree,
            context_length: contextLength,
            pricing_prompt: pricingPrompt,
            pricing_completion: pricingCompletion,
            provider: this.extractProvider(model.id),
            cached_at: Date.now(),
        };
    }

    /**
     * Refresh catalog from API
     */
    async refresh(): Promise<void> {
        const response = await this.client.listModels();
        this.cache = response.data.map((model) => this.toMetadata(model));
        this.cacheTimestamp = Date.now();
    }

    /**
     * Ensure catalog is loaded and fresh
     */
    async ensureFresh(): Promise<void> {
        if (this.isCacheStale()) {
            await this.refresh();
        }
    }

    /**
     * Get all models (auto-refresh if stale)
     */
    async getAllModels(): Promise<ModelMetadata[]> {
        await this.ensureFresh();
        return [...this.cache];
    }

    /**
     * Get free models only
     */
    async getFreeModels(): Promise<ModelMetadata[]> {
        await this.ensureFresh();
        return this.cache.filter((m) => m.is_free);
    }

    /**
     * Get paid models only
     */
    async getPaidModels(): Promise<ModelMetadata[]> {
        await this.ensureFresh();
        return this.cache.filter((m) => !m.is_free);
    }

    /**
     * Query models with filters
     */
    async queryModels(query: CatalogQuery): Promise<ModelMetadata[]> {
        await this.ensureFresh();

        let results = [...this.cache];

        // Filter by free/paid
        if (query.free_only) {
            results = results.filter((m) => m.is_free);
        }

        // Filter by minimum context length
        if (query.min_context !== undefined) {
            results = results.filter((m) => m.context_length >= query.min_context!);
        }

        // Filter by providers
        if (query.providers && query.providers.length > 0) {
            results = results.filter((m) => query.providers!.includes(m.provider));
        }

        return results;
    }

    /**
     * Find model by ID
     */
    async findModel(modelId: string): Promise<ModelMetadata | undefined> {
        await this.ensureFresh();
        return this.cache.find((m) => m.id === modelId);
    }

    /**
     * Get cache stats
     */
    getCacheStats(): { count: number; age_ms: number; stale: boolean } {
        return {
            count: this.cache.length,
            age_ms: Date.now() - this.cacheTimestamp,
            stale: this.isCacheStale(),
        };
    }
}
