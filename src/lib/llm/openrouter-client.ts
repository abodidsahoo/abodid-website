/**
 * OpenRouter HTTP Client
 * 
 * Handles all HTTP communication with OpenRouter API:
 * - GET /models for catalog
 * - POST /chat/completions for execution
 */

import type {
    OpenRouterModelsResponse,
    OpenRouterChatCompletionRequest,
    OpenRouterChatCompletionResponse,
    OpenRouterErrorResponse,
} from './types';

export class OpenRouterClient {
    private apiKey: string;
    private baseUrl: string;
    private siteUrl: string;
    private siteName: string;
    private connectTimeout: number;
    private requestTimeout: number;

    constructor(config: {
        apiKey: string;
        baseUrl?: string;
        siteUrl?: string;
        siteName?: string;
        connectTimeout?: number;
        requestTimeout?: number;
    }) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
        this.siteUrl = config.siteUrl || '';
        this.siteName = config.siteName || '';
        this.connectTimeout = config.connectTimeout || 5000;
        this.requestTimeout = config.requestTimeout || 60000;
    }

    /**
     * Build common headers for all requests
     */
    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };

        if (this.siteUrl) {
            headers['HTTP-Referer'] = this.siteUrl;
        }

        if (this.siteName) {
            headers['X-Title'] = this.siteName;
        }

        return headers;
    }

    /**
     * Fetch with timeout support
     */
    private async fetchWithTimeout(
        url: string,
        options: RequestInit,
        timeoutMs: number
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeoutMs}ms`);
            }
            throw error;
        }
    }

    /**
     * Parse error response
     */
    private async parseError(response: Response): Promise<Error> {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
            const errorData: OpenRouterErrorResponse = await response.json();
            if (errorData.error?.message) {
                errorMessage = errorData.error.message;
            }
        } catch {
            // If JSON parsing fails, use the default error message
        }

        const error = new Error(errorMessage);
        (error as any).status = response.status;
        (error as any).statusText = response.statusText;
        return error;
    }

    /**
     * List all available models
     * GET /models
     */
    async listModels(): Promise<OpenRouterModelsResponse> {
        const url = `${this.baseUrl}/models`;

        const response = await this.fetchWithTimeout(
            url,
            {
                method: 'GET',
                headers: this.getHeaders(),
            },
            this.connectTimeout
        );

        if (!response.ok) {
            throw await this.parseError(response);
        }

        return await response.json();
    }

    /**
     * Send chat completion request
     * POST /chat/completions
     */
    async chatCompletions(
        payload: OpenRouterChatCompletionRequest
    ): Promise<OpenRouterChatCompletionResponse> {
        const url = `${this.baseUrl}/chat/completions`;

        const response = await this.fetchWithTimeout(
            url,
            {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload),
            },
            this.requestTimeout
        );

        if (!response.ok) {
            const error = await this.parseError(response);
            // Attach status for quota/retry logic
            (error as any).status = response.status;
            throw error;
        }

        return await response.json();
    }

    /**
     * Check if error is retriable (429, 5xx)
     */
    static isRetriableError(error: any): boolean {
        const status = error?.status;
        return status === 429 || (status >= 500 && status < 600);
    }

    /**
     * Check if error indicates invalid model
     */
    static isInvalidModelError(error: any): boolean {
        const message = error?.message?.toLowerCase() || '';
        return (
            message.includes('model not found') ||
            message.includes('invalid model') ||
            message.includes('model does not exist')
        );
    }
}
