/**
 * Policy Engine
 * 
 * Implements free-first routing with intelligent model selection.
 * Ranks candidates based on: free bonus, context headroom, health, and cost.
 */

import type {
    TaskRequirements,
    ModelMetadata,
    ModelCandidate,
    RoutingPolicy,
} from './types';
import { ModelCatalogService } from './model-catalog-service';
import { Telemetry } from './telemetry';

export class PolicyEngine {
    private catalog: ModelCatalogService;
    private telemetry: Telemetry;
    private policy: RoutingPolicy;

    constructor(
        catalog: ModelCatalogService,
        telemetry: Telemetry,
        policy?: Partial<RoutingPolicy>
    ) {
        this.catalog = catalog;
        this.telemetry = telemetry;

        // Default policy
        this.policy = {
            allow_paid_fallback: policy?.allow_paid_fallback ?? false,
            free_bonus: policy?.free_bonus ?? 100,
            context_weight: policy?.context_weight ?? 10,
            health_weight: policy?.health_weight ?? 50,
            cost_weight: policy?.cost_weight ?? 30,
        };
    }

    /**
     * Calculate score for a model candidate
     */
    private scoreModel(
        model: ModelMetadata,
        requirements: TaskRequirements
    ): number {
        let score = 0;

        // 1. Free bonus
        if (model.is_free) {
            score += this.policy.free_bonus;
        }

        // 2. Context headroom
        const minContext = requirements.min_context || 4096;
        const contextHeadroom = Math.max(0, model.context_length - minContext);
        score += (contextHeadroom / 1000) * this.policy.context_weight;

        // 3. Health score
        const health = this.telemetry.getHealthScore(model.id);
        const healthScore = health.success_rate * 100;

        // Penalize high error rate models
        const errorPenalty = (health.error_rate_429 + health.error_rate_5xx) * 50;
        score += (healthScore - errorPenalty) * (this.policy.health_weight / 100);

        // Penalize high latency
        const latencyPenalty = health.avg_latency_ms > 0
            ? Math.min(health.avg_latency_ms / 1000, 10)
            : 0;
        score -= latencyPenalty;

        // 4. Cost (lower is better for paid models)
        if (!model.is_free) {
            const avgCost = (model.pricing_prompt + model.pricing_completion) / 2;
            const costPenalty = avgCost * 1000; // Scale to reasonable range
            score -= costPenalty * (this.policy.cost_weight / 100);
        }

        return score;
    }

    /**
     * Get routing candidates for a task
     * Returns ordered list (best first)
     */
    async getCandidates(
        requirements: TaskRequirements,
        quotaAvailable: boolean
    ): Promise<ModelCandidate[]> {
        // Determine if we can use paid fallback
        const allowPaid = requirements.allow_paid_fallback ?? this.policy.allow_paid_fallback;

        // Build candidate set
        let candidates: ModelMetadata[] = [];

        if (quotaAvailable) {
            // Primary: free models
            const freeModels = await this.catalog.queryModels({
                free_only: true,
                min_context: requirements.min_context,
                providers: requirements.preferred_providers,
            });
            candidates.push(...freeModels);
        }

        if (allowPaid && (!quotaAvailable || candidates.length === 0)) {
            // Secondary: paid models
            const paidModels = await this.catalog.queryModels({
                free_only: false,
                min_context: requirements.min_context,
                providers: requirements.preferred_providers,
            });
            candidates.push(...paidModels.filter((m) => !m.is_free));
        }

        // Score and rank
        const scoredCandidates = candidates.map((model) => {
            const score = this.scoreModel(model, requirements);
            const reason = this.explainScore(model, requirements);

            return {
                model,
                score,
                reason,
            };
        });

        // Sort by score (descending)
        scoredCandidates.sort((a, b) => b.score - a.score);

        return scoredCandidates;
    }

    /**
     * Explain why a model was scored the way it was
     */
    private explainScore(model: ModelMetadata, requirements: TaskRequirements): string {
        const parts: string[] = [];

        if (model.is_free) {
            parts.push('free tier');
        }

        const minContext = requirements.min_context || 4096;
        if (model.context_length > minContext * 1.5) {
            parts.push('large context');
        }

        const health = this.telemetry.getHealthScore(model.id);
        if (health.sample_size > 0) {
            if (health.success_rate > 0.95) {
                parts.push('reliable');
            } else if (health.success_rate < 0.7) {
                parts.push('unstable');
            }
        }

        if (requirements.latency_tier === 'interactive' && health.avg_latency_ms > 5000) {
            parts.push('slow for interactive');
        }

        return parts.length > 0 ? parts.join(', ') : 'baseline';
    }

    /**
     * Update policy at runtime
     */
    updatePolicy(updates: Partial<RoutingPolicy>): void {
        this.policy = { ...this.policy, ...updates };
    }

    /**
     * Get current policy
     */
    getPolicy(): RoutingPolicy {
        return { ...this.policy };
    }
}
