# LLM Integration Library

Production-ready OpenRouter integration with free-tier optimization, intelligent routing, quota management, and automatic failover.

## 🎯 Features

- **Free-First Routing**: Automatically prefers free models, falls back to paid only when needed
- **Quota Management**: Enforces OpenRouter's 20 RPM and daily limits
- **Intelligent Failover**: Automatic retry with exponential backoff and model switching
- **Health Scoring**: Tracks model reliability and performance
- **Task-Agnostic**: Works for any LLM task (chat, JSON, tools, etc.)
- **Type-Safe**: Full TypeScript support with comprehensive types
- **Observable**: Built-in telemetry and monitoring

## 📁 Architecture

```
src/lib/llm/
├── types.ts                    # TypeScript type definitions
├── openrouter-client.ts        # HTTP client for OpenRouter API
├── model-catalog-service.ts    # Model discovery and caching
├── quota-manager.ts            # Free-tier quota enforcement
├── telemetry.ts               # Logging and health scoring
├── policy-engine.ts           # Free-first routing logic
├── executor.ts                # Retry and failover orchestration
├── llm-service.ts             # Unified API surface
├── examples.ts                # Usage examples
├── index.ts                   # Main exports
└── README.md                  # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

The system uses the native Fetch API, so no additional HTTP libraries are needed for basic usage.

For Redis-backed quota management in production (optional):
```bash
npm install ioredis
```

### 2. Set Up Environment Variables

```env
# Required
OPENROUTER_API_KEY=your_api_key_here

# Optional (for analytics)
PUBLIC_SITE_URL=https://abodidsahoo.com
PUBLIC_SITE_NAME=Abodid Sahoo
```

### 3. Basic Usage

```typescript
import { createLLMService } from '@/lib/llm';

// Create service from environment variables
const llm = createLLMService();

// Simple chat
const response = await llm.chat([
  { role: 'user', content: 'What is the meaning of life?' }
]);

console.log(response);
```

## 📖 Usage Examples

### Emotion Analysis (for invisible punctum)

```typescript
import { createLLMService } from '@/lib/llm';

const llm = createLLMService();

interface EmotionResult {
  primary_emotion: string;
  intensity: number;
  sentiment_score: number;
}

const result = await llm.chatJSON<EmotionResult>([
  {
    role: 'system',
    content: 'Analyze emotions in user comments. Respond with JSON.',
  },
  {
    role: 'user',
    content: `Analyze: "This photo brings back childhood memories..."`,
  }
]);

console.log(result.primary_emotion); // "nostalgia"
```

### Photography Comment Analysis

```typescript
const analysis = await llm.chatJSON({
  messages: [
    {
      role: 'system',
      content: 'You are an expert in analyzing photographic impact.',
    },
    {
      role: 'user',
      content: `Analyze this comment about a photograph...`,
    }
  ],
  requirements: {
    min_context: 8192,
    needs_json: true,
    latency_tier: 'interactive',
  }
});
```

### Batch Processing with Quota Management

```typescript
const llm = createLLMService({
  quotaRPM: 20,
  quotaRPD: 1000,
});

for (const comment of comments) {
  const quota = await llm.getQuotaStatus();
  
  if (!quota.available) {
    await new Promise(r => setTimeout(r, quota.reset_in_ms));
  }
  
  const result = await llm.chat([
    { role: 'user', content: comment }
  ]);
}
```

## 🔧 Configuration

### Service Configuration

```typescript
import { LLMService } from '@/lib/llm';

const llm = new LLMService({
  apiKey: 'your_key',
  siteUrl: 'https://yoursite.com',
  siteName: 'Your Site',
  
  // Catalog settings
  catalogTTLMinutes: 60,
  
  // Quota limits (OpenRouter free tier)
  quotaRPM: 20,      // Requests per minute
  quotaRPD: 1000,    // Requests per day
  
  // Routing policy
  allowPaidFallback: false,  // Stay on free tier only
});
```

### Task Requirements

```typescript
await llm.execute({
  messages: [...],
  requirements: {
    min_context: 8192,           // Minimum context window
    needs_json: true,            // Prefer JSON-capable models
    latency_tier: 'interactive', // vs 'batch'
    allow_paid_fallback: false,  // Override global setting
    preferred_providers: ['openai', 'anthropic'],
  }
});
```

## 📊 Monitoring

### Get Quota Status

```typescript
const status = await llm.getQuotaStatus();
console.log(`Used: ${status.requests_this_minute}/${status.max_rpm} per minute`);
console.log(`Today: ${status.requests_today}/${status.max_rpd}`);
console.log(`Available: ${status.available}`);
```

### Telemetry Summary

```typescript
const summary = llm.getTelemetrySummary();
console.log(`Total requests: ${summary.total_requests}`);
console.log(`Free requests: ${summary.free_requests}`);
console.log(`Errors: ${summary.total_errors}`);
console.log(`Avg latency: ${summary.avg_latency_ms}ms`);
```

### Model Health Scores

```typescript
const scores = llm.getHealthScores();
scores.forEach(score => {
  console.log(`${score.model_id}:`);
  console.log(`  Success rate: ${score.success_rate}`);
  console.log(`  Avg latency: ${score.avg_latency_ms}ms`);
  console.log(`  429 errors: ${score.error_rate_429}`);
});
```

## 🎯 Use Cases for Invisible Punctum

1. **Emotion Analysis**: Analyze visitor comments for emotional content
2. **Punctum Detection**: Identify personal connections in photo responses
3. **Sentiment Tracking**: Track sentiment trends across photography submissions
4. **Content Moderation**: Flag inappropriate or spam comments
5. **Insight Generation**: Generate summaries of visitor feedback

See [`examples.ts`](file:///Users/abodid/Documents/GitHub/personal-site/src/lib/llm/examples.ts) for detailed implementations.

## 🔒 Security

- ✅ API keys never logged or exposed
- ✅ Secrets loaded from environment variables
- ✅ Rate limiting to prevent quota burn
- ✅ Request/response content can be redacted in logs

## 🧪 Testing

```typescript
// Reset quota for testing
llm.resetQuota();

// Clear telemetry
llm.clearTelemetry();

// Force catalog refresh
await llm.refreshCatalog();
```

## 📚 API Reference

### Main Methods

- `execute(request: TaskRequest): Promise<TaskResponse>` - Execute any LLM task
- `chat(messages, options): Promise<string>` - Simple chat completion
- `chatJSON<T>(messages, options): Promise<T>` - JSON response
- `getQuotaStatus(): Promise<QuotaStatus>` - Check quota
- `getTelemetrySummary()` - Get usage stats
- `getHealthScores()` - Get model health metrics

See [`types.ts`](file:///Users/abodid/Documents/GitHub/personal-site/src/lib/llm/types.ts) for complete type definitions.

## 🔄 Migration from Hugging Face

Replace your existing HF inference calls with:

```typescript
// Before (Hugging Face)
const result = await hf.textClassification({
  model: 'emotion-model',
  inputs: comment,
});

// After (OpenRouter)
const result = await llm.chatJSON<EmotionResult>([
  { role: 'system', content: 'Analyze emotions...' },
  { role: 'user', content: comment }
]);
```

Benefits:
- More powerful models (GPT, Claude, etc.)
- Free tier available
- Automatic failover
- Better context understanding

## 📝 Resources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [OpenRouter Models](https://openrouter.ai/models)
- [Free Models List](https://openrouter.ai/models?free=true)

