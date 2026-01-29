/**
 * Usage Examples for LLM Service
 * 
 * Demonstrates how to use the OpenRouter integration for various tasks.
 */

import { createLLMService } from './llm-service';
import type { TaskRequest } from './types';

// ============================================================================
// Example 1: Simple ChatCompletion
// ============================================================================

async function simpleChat() {
    const llm = createLLMService();

    const response = await llm.chat([
        { role: 'user', content: 'What is the meaning of life?' },
    ]);

    console.log(response);
}

// ============================================================================
// Example 2: Conversation with Context
// ============================================================================

async function conversationWithContext() {
    const llm = createLLMService();

    const response = await llm.chat([
        { role: 'system', content: 'You are a helpful photography assistant.' },
        { role: 'user', content: 'What camera settings should I use for portraits?' },
    ], {
        temperature: 0.7,
        max_tokens: 500,
    });

    console.log(response);
}

// ============================================================================
// Example 3: JSON Response for Structured Data
// ============================================================================

async function emotionAnalysis() {
    const llm = createLLMService();

    interface EmotionAnalysisResult {
        primary_emotion: string;
        intensity: number;
        secondary_emotions: string[];
        sentiment_score: number;
    }

    const userComment = "This photo brings back so many memories of my childhood. It's both joyful and a bit melancholic.";

    const result = await llm.chatJSON<EmotionAnalysisResult>([
        {
            role: 'system',
            content: 'You are an emotion analysis expert. Analyze the emotional content of user comments and respond with structured JSON.',
        },
        {
            role: 'user',
            content: `Analyze the emotions in this comment: "${userComment}"\n\nRespond with JSON containing:\n- primary_emotion (string)\n- intensity (0-1)\n- secondary_emotions (array)\n- sentiment_score (-1 to 1)`,
        },
    ]);

    console.log('Emotion Analysis:', result);
}

// ============================================================================
// Example 4: Image Analysis (for invisible punctum project)
// ============================================================================

async function analyzePhotographyComment(
    imageDescription: string,
    userComment: string
) {
    const llm = createLLMService();

    interface PunctumAnalysis {
        has_punctum: boolean;
        punctum_elements: string[];
        emotional_resonance: string;
        personal_connection_strength: number;
        analysis: string;
    }

    const result = await llm.chatJSON<PunctumAnalysis>([
        {
            role: 'system',
            content: `You are an expert in Roland Barthes's concept of "punctum" in photography. 
The punctum is the element in a photograph that pierces, wounds, or deeply moves the viewer on a personal level.
Analyze user comments to identify if they describe experiencing a punctum.`,
        },
        {
            role: 'user',
            content: `Image context: ${imageDescription}
      
User comment: "${userComment}"

Analyze whether this comment describes a punctum experience. Respond with JSON containing:
- has_punctum (boolean): does the comment describe a punctum?
- punctum_elements (array): specific elements mentioned that triggered the punctum
- emotional_resonance (string): the emotional quality
- personal_connection_strength (0-1): how personal/deep is the connection
- analysis (string): brief explanation`,
        },
    ], {
        temperature: 0.3, // Lower temperature for more consistent analysis
    });

    return result;
}

// ============================================================================
// Example 5: Batch Processing with Quota Management
// ============================================================================

async function batchEmotionAnalysis(comments: string[]) {
    const llm = createLLMService({
        quotaRPM: 20,  // 20 requests per minute
        quotaRPD: 1000, // 1000 requests per day
    });

    const results = [];

    for (const comment of comments) {
        // Check quota before processing
        const quota = await llm.getQuotaStatus();

        if (!quota.available) {
            console.log(`Quota exceeded. Waiting ${quota.reset_in_ms}ms...`);
            await new Promise(resolve => setTimeout(resolve, quota.reset_in_ms || 60000));
        }

        try {
            const result = await llm.chat([
                { role: 'system', content: 'Analyze the emotion in this comment briefly.' },
                { role: 'user', content: comment },
            ], {
                max_tokens: 100,
            });

            results.push({ comment, emotion: result });
        } catch (error) {
            console.error('Failed to analyze:', comment, error);
            results.push({ comment, error: (error as Error).message });
        }
    }

    return results;
}

// ============================================================================
// Example 6: Advanced Task with Full Control
// ============================================================================

async function advancedTask() {
    const llm = createLLMService({
        allowPaidFallback: false, // Stay on free tier only
    });

    const request: TaskRequest = {
        messages: [
            {
                role: 'system',
                content: 'You are a creative writing assistant for photography descriptions.',
            },
            {
                role: 'user',
                content: 'Write a poetic description of a sunset photograph.',
            },
        ],
        temperature: 0.9,
        max_tokens: 200,
        requirements: {
            min_context: 4096,
            latency_tier: 'interactive',
            allow_paid_fallback: false,
        },
    };

    const response = await llm.execute(request);

    console.log('Response:', response.message.content);
    console.log('Model used:', response.model_used);
    console.log('Is free:', response.is_free);
    console.log('Latency:', response.latency_ms, 'ms');
}

// ============================================================================
// Example 7: Monitoring and Telemetry
// ============================================================================

async function monitoringExample() {
    const llm = createLLMService();

    // Make some requests...
    await llm.chat([{ role: 'user', content: 'Hello!' }]);
    await llm.chat([{ role: 'user', content: 'How are you?' }]);

    // Get telemetry
    const summary = llm.getTelemetrySummary();
    console.log('Telemetry Summary:', summary);

    // Get health scores
    const healthScores = llm.getHealthScores();
    console.log('Model Health Scores:', healthScores);

    // Get catalog stats
    const catalogStats = llm.getCatalogStats();
    console.log('Catalog Stats:', catalogStats);
}

// ============================================================================
// Export for use in other modules
// ============================================================================

export {
    simpleChat,
    conversationWithContext,
    emotionAnalysis,
    analyzePhotographyComment,
    batchEmotionAnalysis,
    advancedTask,
    monitoringExample,
};
