/**
 * Telemetry Service
 * 
 * Handles structured logging and health scoring for models.
 * Tracks success rates, latencies, and error patterns.
 */

import type { TelemetryEvent, ModelHealthScore } from './types';

export class Telemetry {
    private events: TelemetryEvent[] = [];
    private maxEvents: number;
    private healthCache: Map<string, ModelHealthScore> = new Map();
    private healthCacheTTL: number = 5 * 60 * 1000; // 5 minutes

    constructor(maxEvents: number = 1000) {
        this.maxEvents = maxEvents;
    }

    /**
     * Log an event
     */
    log(event: Omit<TelemetryEvent, 'timestamp'>): void {
        const fullEvent: TelemetryEvent = {
            ...event,
            timestamp: Date.now(),
        };

        this.events.push(fullEvent);

        // Keep only recent events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        // Log to console (in production, send to logging service)
        this.logToConsole(fullEvent);

        // Invalidate health cache for this model
        this.healthCache.delete(event.model_id);
    }

    /**
     * Log to console with structured format
     */
    private logToConsole(event: TelemetryEvent): void {
        const timestamp = new Date(event.timestamp).toISOString();
        const tier = event.is_free ? 'FREE' : 'PAID';

        if (event.event_type === 'request') {
            console.log(
                `[LLM] ${timestamp} | ${event.event_type.toUpperCase()} | ${event.model_id} (${tier}) | ${event.latency_ms}ms`
            );
        } else if (event.event_type === 'error') {
            console.error(
                `[LLM] ${timestamp} | ${event.event_type.toUpperCase()} | ${event.model_id} (${tier}) | ${event.error_code}: ${event.error_message}`
            );
        } else if (event.event_type === 'fallback') {
            console.warn(
                `[LLM] ${timestamp} | ${event.event_type.toUpperCase()} | ${event.model_id} (${tier}) | Failover #${event.failover_count}`
            );
        }
    }

    /**
     * Calculate health score for a model
     */
    getHealthScore(modelId: string): ModelHealthScore {
        // Check cache
        const cached = this.healthCache.get(modelId);
        if (cached && Date.now() - cached.last_updated < this.healthCacheTTL) {
            return cached;
        }

        // Calculate from recent events (last hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const modelEvents = this.events.filter(
            (e) => e.model_id === modelId && e.timestamp > oneHourAgo
        );

        if (modelEvents.length === 0) {
            // No data, return neutral score
            const score: ModelHealthScore = {
                model_id: modelId,
                success_rate: 0.5,
                avg_latency_ms: 0,
                error_rate_429: 0,
                error_rate_5xx: 0,
                last_updated: Date.now(),
                sample_size: 0,
            };
            this.healthCache.set(modelId, score);
            return score;
        }

        // Calculate metrics
        const requestEvents = modelEvents.filter((e) => e.event_type === 'request');
        const errorEvents = modelEvents.filter((e) => e.event_type === 'error');

        const error429Count = errorEvents.filter((e) => e.error_code === 429).length;
        const error5xxCount = errorEvents.filter(
            (e) => typeof e.error_code === 'number' && e.error_code >= 500 && e.error_code < 600
        ).length;

        const totalRequests = requestEvents.length + errorEvents.length;
        const successRate = totalRequests > 0 ? requestEvents.length / totalRequests : 0.5;

        const latencies = requestEvents
            .map((e) => e.latency_ms)
            .filter((l): l is number => l !== undefined);
        const avgLatency = latencies.length > 0
            ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
            : 0;

        const error429Rate = totalRequests > 0 ? error429Count / totalRequests : 0;
        const error5xxRate = totalRequests > 0 ? error5xxCount / totalRequests : 0;

        const score: ModelHealthScore = {
            model_id: modelId,
            success_rate: successRate,
            avg_latency_ms: avgLatency,
            error_rate_429: error429Rate,
            error_rate_5xx: error5xxRate,
            last_updated: Date.now(),
            sample_size: totalRequests,
        };

        this.healthCache.set(modelId, score);
        return score;
    }

    /**
     * Get all health scores (for monitoring)
     */
    getAllHealthScores(): ModelHealthScore[] {
        const modelIds = new Set(this.events.map((e) => e.model_id));
        return Array.from(modelIds).map((id) => this.getHealthScore(id));
    }

    /**
     * Get recent events for a model
     */
    getModelEvents(modelId: string, limit: number = 100): TelemetryEvent[] {
        return this.events
            .filter((e) => e.model_id === modelId)
            .slice(-limit);
    }

    /**
     * Clear all events (for testing)
     */
    clear(): void {
        this.events = [];
        this.healthCache.clear();
    }

    /**
     * Get telemetry summary
     */
    getSummary(): {
        total_events: number;
        total_requests: number;
        total_errors: number;
        avg_latency_ms: number;
        free_requests: number;
        paid_requests: number;
    } {
        const requestEvents = this.events.filter((e) => e.event_type === 'request');
        const errorEvents = this.events.filter((e) => e.event_type === 'error');

        const latencies = requestEvents
            .map((e) => e.latency_ms)
            .filter((l): l is number => l !== undefined);
        const avgLatency = latencies.length > 0
            ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
            : 0;

        const freeRequests = requestEvents.filter((e) => e.is_free).length;
        const paidRequests = requestEvents.filter((e) => !e.is_free).length;

        return {
            total_events: this.events.length,
            total_requests: requestEvents.length,
            total_errors: errorEvents.length,
            avg_latency_ms: avgLatency,
            free_requests: freeRequests,
            paid_requests: paidRequests,
        };
    }
}
