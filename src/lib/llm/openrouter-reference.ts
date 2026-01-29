/**
 * OpenRouter API Integration Reference
 * 
 * This file contains reference code for integrating OpenRouter's LLM API
 * into your website applications. Use this as a template when building
 * LLM-powered features within the site.
 * 
 * Setup Instructions:
 * 1. Install the OpenRouter SDK: npm install @openrouter/sdk
 * 2. Set up environment variables in .env:
 *    - OPENROUTER_API_KEY=your_api_key_here
 *    - PUBLIC_SITE_URL=your_site_url
 *    - PUBLIC_SITE_NAME=your_site_name
 * 
 * Usage:
 * - Import and adapt this code for your specific use cases
 * - Consider creating wrapper functions for common operations
 * - Add error handling and rate limiting as needed
 */

import { OpenRouter } from '@openrouter/sdk';

/**
 * Initialize OpenRouter client
 * Uses Astro's environment variables (import.meta.env)
 * 
 * Required: OPENROUTER_API_KEY (never use PUBLIC_ prefix for API keys!)
 * Optional: PUBLIC_SITE_URL, PUBLIC_SITE_NAME
 */
const openRouter = new OpenRouter({
    apiKey: import.meta.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': import.meta.env.PUBLIC_SITE_URL || 'https://abodidsahoo.com', // Optional
        'X-Title': import.meta.env.PUBLIC_SITE_NAME || 'Abodid Sahoo', // Optional
    },
});

/**
 * Example: Basic chat completion
 * This demonstrates how to send a simple message to the LLM
 */
async function basicChatExample() {
    const completion = await openRouter.chat.send({
        model: 'openai/gpt-5.2',
        messages: [
            {
                role: 'user',
                content: 'What is the meaning of life?',
            },
        ],
        stream: false,
    });

    console.log(completion.choices[0].message.content);
    return completion.choices[0].message.content;
}

/**
 * Example: Streaming chat completion
 * Use this for real-time response streaming in your UI
 */
async function streamingChatExample() {
    const completion = await openRouter.chat.send({
        model: 'openai/gpt-5.2',
        messages: [
            {
                role: 'user',
                content: 'Tell me a story',
            },
        ],
        stream: true,
    });

    // Handle streaming response
    for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
            console.log(content);
        }
    }
}

/**
 * Example: Multi-turn conversation
 * Maintain conversation context across multiple messages
 */
async function conversationExample() {
    const messages = [
        { role: 'user', content: 'Hello! My name is Alice.' },
        { role: 'assistant', content: 'Nice to meet you, Alice! How can I help you today?' },
        { role: 'user', content: 'What was my name again?' },
    ];

    const completion = await openRouter.chat.send({
        model: 'openai/gpt-5.2',
        messages: messages,
        stream: false,
    });

    return completion.choices[0].message.content;
}

/**
 * Example: Custom system prompt
 * Define the AI's behavior and personality
 */
async function customSystemPromptExample() {
    const completion = await openRouter.chat.send({
        model: 'openai/gpt-5.2',
        messages: [
            {
                role: 'system',
                content: 'You are a helpful assistant for a photography website. Provide creative and inspiring responses about photography, art, and visual storytelling.',
            },
            {
                role: 'user',
                content: 'Give me tips for better portrait photography',
            },
        ],
        stream: false,
    });

    return completion.choices[0].message.content;
}

// Export functions for use in other parts of the application
export {
    openRouter,
    basicChatExample,
    streamingChatExample,
    conversationExample,
    customSystemPromptExample,
};
