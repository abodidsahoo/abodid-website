# OpenRouter LLM Integration for Invisible Punctum

Quick integration guide for replacing Hugging Face with OpenRouter API in your photography project.

## Current State (Hugging Face)

Your invisible punctum project currently uses Hugging Face for emotion analysis. You'll replace this with the new OpenRouter integration.

## New Architecture

```
OpenRouter API (GPT, Claude, etc.)
         ↓
  LLM Service (Free-first routing)
         ↓
  Your App (Emotion analysis, punctum detection)
```

## Integration Steps

### 1. Add API Key to Environment

Add to `.env`:
```env
OPENROUTER_API_KEY=your_actual_key_here
```

Get your key from: https://openrouter.ai/keys

### 2. Replace Hugging Face Calls

**Before (Hugging Face):**
```python
# Old Python-based emotion analysis
result = hf.inference(model="emotion", text=comment)
```

**After (OpenRouter):**
```typescript
import { createLLMService } from '@/lib/llm';

const llm = createLLMService();

interface EmotionAnalysis {
  primary_emotion: string;
  secondary_emotions: string[];
  intensity: number;
  sentiment_score: number;
}

const result = await llm.chatJSON<EmotionAnalysis>([
  {
    role: 'system',
    content: 'You are an emotion analysis expert. Analyze comments and respond with structured JSON containing primary_emotion, secondary_emotions (array), intensity (0-1), and sentiment_score (-1 to 1).',
  },
  {
    role: 'user',
    content: `Analyze the emotions in this photography comment: "${comment}"`,
  }
]);
```

### 3. Example: Punctum Detection API Endpoint

Create a new API endpoint at `src/pages/api/analyze-punctum.ts`:

```typescript
import type { APIRoute } from 'astro';
import { createLLMService } from '@/lib/llm';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { image_description, user_comment } = await request.json();

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
The punctum is the element that pierces, wounds, or deeply moves the viewer on a personal level.
Analyze comments to identify punctum experiences.`,
      },
      {
        role: 'user',
        content: `Image: ${image_description}
Comment: "${user_comment}"

Analyze whether this comment describes a punctum experience. Respond with JSON.`,
      }
    ], {
      temperature: 0.3, // Lower for consistent analysis
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

### 4. Call from Frontend

```typescript
// In your Astro component or client-side script
async function analyzePunctum(imageDesc: string, comment: string) {
  const response = await fetch('/api/analyze-punctum', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_description: imageDesc,
      user_comment: comment,
    }),
  });

  const analysis = await response.json();
  
  if (analysis.has_punctum) {
    console.log('Punctum detected!', analysis.punctum_elements);
  }
  
  return analysis;
}
```

### 5. Batch Analysis with Quota Management

For analyzing multiple comments:

```typescript
import { createLLMService } from '@/lib/llm';

async function batchAnalyzeComments(comments: Array<{id: string, text: string}>) {
  const llm = createLLMService({
    quotaRPM: 20,   // Free tier: 20 per minute
    quotaRPD: 1000, // Free tier: 1000 per day
  });

  const results = [];

  for (const comment of comments) {
    // Check quota
    const quota = await llm.getQuotaStatus();
    if (!quota.available) {
      console.log('Quota exceeded, waiting...');
      await new Promise(r => setTimeout(r, quota.reset_in_ms || 60000));
    }

    try {
      const analysis = await llm.chatJSON([
        { role: 'system', content: 'Analyze emotions briefly.' },
        { role: 'user', content: comment.text }
      ]);
      
      results.push({ id: comment.id, analysis });
    } catch (error) {
      console.error('Failed:', comment.id, error);
      results.push({ id: comment.id, error: (error as Error).message });
    }
  }

  return results;
}
```

## Free vs Paid Models

The system automatically uses free models first:

- **Free models**: IDs ending in `:free` (e.g., `meta-llama/llama-3.3-70b-instruct:free`)
- **Paid models**: Only used if you set `allowPaidFallback: true`

To stay on free tier only:

```typescript
const llm = createLLMService({
  allowPaidFallback: false, // Never use paid models
});
```

## Monitoring Usage

```typescript
// Check current usage
const quota = await llm.getQuotaStatus();
console.log(`Used ${quota.requests_this_minute}/${quota.max_rpm} this minute`);
console.log(`Used ${quota.requests_today}/${quota.max_rpd} today`);

// Get telemetry
const stats = llm.getTelemetrySummary();
console.log(`Total requests: ${stats.total_requests}`);
console.log(`Free: ${stats.free_requests}, Paid: ${stats.paid_requests}`);
console.log(`Errors: ${stats.total_errors}`);
```

## Migration Checklist

- [ ] Get OpenRouter API key and add to `.env`
- [ ] Create API endpoint for emotion analysis (`/api/analyze-emotion`)
- [ ] Create API endpoint for punctum detection (`/api/analyze-punctum`)
- [ ] Update frontend to call new endpoints
- [ ] Remove Hugging Face dependencies
- [ ] Test with sample comments
- [ ] Monitor quota usage
- [ ] Set up error handling

## Benefits Over Hugging Face

✅ **More Powerful Models**: Access to GPT-4, Claude, and other state-of-the-art models  
✅ **Better Context**: Understanding of complex emotional nuances  
✅ **Structured Output**: Native JSON support for clean data  
✅ **Free Tier**: Generous free quota (1000 requests/day)  
✅ **Automatic Failover**: Falls back to alternative models if one fails  
✅ **No Python Required**: Pure TypeScript/JavaScript  

## Next Steps

1. Get your OpenRouter API key: https://openrouter.ai/keys
2. Test with a single comment first
3. Gradually migrate existing functionality
4. Monitor quota usage and adjust if needed

See [`examples.ts`](file:///Users/abodid/Documents/GitHub/personal-site/src/lib/llm/examples.ts) for more detailed examples.
