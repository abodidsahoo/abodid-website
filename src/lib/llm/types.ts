/**
 * Type definitions for OpenRouter LLM integration
 */

// ============================================================================
// OpenRouter API Types
// ============================================================================

export interface OpenRouterModel {
    id: string;
    name: string;
    created: number;
    context_length?: number;
    pricing?: {
        prompt: string;
        completion: string;
        request?: string;
        image?: string;
    };
    top_provider?: {
        context_length?: number;
        max_completion_tokens?: number;
        is_moderated?: boolean;
    };
    architecture?: {
        modality?: string;
        tokenizer?: string;
        instruct_type?: string | null;
    };
}

export interface OpenRouterModelsResponse {
    data: OpenRouterModel[];
}

export interface OpenRouterChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }>;
}

export interface OpenRouterChatCompletionRequest {
    model: string;
    messages: OpenRouterChatMessage[];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | string[];
    stream?: boolean;
    response_format?: {
        type: 'json_object' | 'text';
    };
    tools?: Array<{
        type: 'function';
        function: {
            name: string;
            description?: string;
            parameters?: Record<string, any>;
        };
    }>;
    tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

export interface OpenRouterChatCompletionResponse {
    id: string;
    model: string;
    created: number;
    object: 'chat.completion';
    choices: Array<{
        index: number;
        message: OpenRouterChatMessage;
        finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface OpenRouterErrorResponse {
    error: {
        message: string;
        type: string;
        code: number | string;
    };
}

// ============================================================================
// Application-Level Task Types
// ============================================================================

export type LatencyTier = 'interactive' | 'batch';

export interface TaskRequirements {
    /** Minimum context length required */
    min_context?: number;

    /** Whether the task needs JSON response format */
    needs_json?: boolean;

    /** Latency requirements */
    latency_tier?: LatencyTier;

    /** Whether to allow paid model fallback */
    allow_paid_fallback?: boolean;

    /** Preferred model providers (e.g., ['openai', 'anthropic']) */
    preferred_providers?: string[];
}

export interface TaskRequest {
    /** Messages for the chat completion */
    messages: OpenRouterChatMessage[];

    /** Response format specification */
    response_format?: {
        type: 'json_object' | 'text';
    };

    /** JSON schema for structured outputs */
    json_schema?: Record<string, any>;

    /** Tool/function definitions */
    tools?: Array<{
        type: 'function';
        function: {
            name: string;
            description?: string;
            parameters?: Record<string, any>;
        };
    }>;

    /** Tool choice strategy */
    tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };

    /** Sampling temperature (0-2) */
    temperature?: number;

    /** Nucleus sampling parameter */
    top_p?: number;

    /** Maximum tokens to generate */
    max_tokens?: number;

    /** Application requirements for routing */
    requirements?: TaskRequirements;
}

export interface TaskResponse {
    /** Response message */
    message: OpenRouterChatMessage;

    /** Model that was used */
    model_used: string;

    /** Whether a free model was used */
    is_free: boolean;

    /** Number of failovers attempted */
    failover_count: number;

    /** Total latency in milliseconds */
    latency_ms: number;

    /** Token usage info */
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// ============================================================================
// Quota Management Types
// ============================================================================

export interface QuotaStatus {
    /** Requests in current minute */
    requests_this_minute: number;

    /** Requests today */
    requests_today: number;

    /** Max requests per minute */
    max_rpm: number;

    /** Max requests per day */
    max_rpd: number;

    /** Whether quota is available */
    available: boolean;

    /** Time until next minute reset (ms) */
    reset_in_ms?: number;
}

export interface QuotaConfig {
    /** Requests per minute limit */
    rpm_limit: number;

    /** Requests per day limit */
    rpd_limit: number;

    /** Redis connection string */
    redis_url?: string;
}

// ============================================================================
// Model Catalog Types
// ============================================================================

export interface ModelMetadata {
    id: string;
    name: string;
    is_free: boolean;
    context_length: number;
    pricing_prompt: number;
    pricing_completion: number;
    provider: string;
    cached_at: number;
}

export interface CatalogQuery {
    /** Filter to free models only */
    free_only?: boolean;

    /** Minimum context length */
    min_context?: number;

    /** Specific providers to include */
    providers?: string[];
}

// ============================================================================
// Routing & Policy Types
// ============================================================================

export interface ModelCandidate {
    model: ModelMetadata;
    score: number;
    reason: string;
}

export interface RoutingPolicy {
    /** Whether to allow paid fallback */
    allow_paid_fallback: boolean;

    /** Free model bonus score */
    free_bonus: number;

    /** Weight for context headroom */
    context_weight: number;

    /** Weight for health score */
    health_weight: number;

    /** Weight for cost (lower is better) */
    cost_weight: number;
}

// ============================================================================
// Telemetry Types
// ============================================================================

export interface TelemetryEvent {
    timestamp: number;
    event_type: 'request' | 'error' | 'fallback';
    model_id: string;
    is_free: boolean;
    latency_ms?: number;
    error_code?: number | string;
    error_message?: string;
    request_chars?: number;
    response_chars?: number;
    failover_count?: number;
}

export interface ModelHealthScore {
    model_id: string;
    success_rate: number;
    avg_latency_ms: number;
    error_rate_429: number;
    error_rate_5xx: number;
    last_updated: number;
    sample_size: number;
}

// ============================================================================
// Executor Types
// ============================================================================

export interface ExecutionConfig {
    /** Maximum number of failovers */
    max_failovers: number;

    /** Maximum total execution time (ms) */
    max_total_time_ms: number;

    /** Initial backoff delay (ms) */
    initial_backoff_ms: number;

    /** Maximum backoff delay (ms) */
    max_backoff_ms: number;

    /** Request timeout (ms) */
    request_timeout_ms: number;
}

export interface ExecutionResult {
    success: boolean;
    response?: TaskResponse;
    error?: {
        message: string;
        code: number | string;
        retriable: boolean;
    };
    attempts: number;
    models_tried: string[];
}
