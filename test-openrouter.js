// Quick test to verify OpenRouter API connectivity
import { LLMService } from '../lib/llm/llm-service.js';

const apiKey = process.env.OPENROUTER_API_KEY || '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';

console.log('🔍 Testing OpenRouter API...');
console.log('API Key present:', apiKey ? '✅ Yes' : '❌ No');
console.log('API Key length:', apiKey?.length);
console.log('API Key starts with:', apiKey?.substring(0, 12));

const llm = new LLMService({
    apiKey: apiKey,
    siteUrl: 'https://abodid.com',
    siteName: 'Abodid Sahoo',
    allowPaidFallback: false,
});

console.log('\n📊 Checking catalog...');
try {
    const stats = llm.getCatalogStats();
    console.log('Catalog stats:', stats);

    console.log('\n💬 Attempting simple chat...');
    const response = await llm.chat([
        { role: 'user', content: 'Say hello in one word' }
    ]);

    console.log('✅ SUCCESS! Response:', response);
} catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Full error:', error);
}
