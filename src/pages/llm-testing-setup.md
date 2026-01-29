# LLM Testing - Quick Setup Guide

## 🚨 Important: API Key Required

The LLM Testing chat is ready to use, but you need to add your OpenRouter API key first.

## Setup Steps

### 1. Get Your OpenRouter API Key

1. Visit: **https://openrouter.ai/keys**
2. Sign up or log in
3. Create a new API key
4. Copy the key

### 2. Add API Key to .env

Open your `.env` file and replace the placeholder:

```env
OPENROUTER_API_KEY=your_actual_api_key_here
```

with your real API key:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

### 3. Restart Dev Server

After adding the key, restart your dev server:

```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

### 4. Test the Chat

Visit: **http://localhost:4321/llm-testing**

Try asking:
- "Hello! What model are you using?"
- "Tell me about yourself"
- "What's the weather today?" (to see internet access message)

## What to Expect

When working correctly, you'll see:

✅ AI responses appear within 2-10 seconds  
✅ Model name displayed (e.g., `meta-llama/llama-3.3-70b-instruct:free`)  
✅ "🆓 Free" badge showing free tier usage  
✅ Response latency in milliseconds  
✅ Warning about no internet access  
✅ Conversation history maintained  

## Features

- **Free Tier Only**: Uses only free OpenRouter models
- **Model Transparency**: Shows which model responded
- **Internet Status**: Clearly indicates no internet access
- **Conversation History**: Maintains context across messages
- **Real-time Quota**: Shows usage limits

## Troubleshooting

### "All model attempts failed" Error

**Cause**: Missing or invalid API key

**Fix**: 
1. Verify your API key in `.env`
2. Make sure there are no extra spaces
3. Restart the dev server

### "Quota exceeded" Error

**Cause**: Hit the free tier limit (20 requests/minute or 1000/day)

**Fix**: 
- Wait a minute and try again
- Check quota at https://openrouter.ai/activity

### No Response

**Cause**: Server not restarted after adding key

**Fix**: Restart `npm run dev`

## Free Tier Limits

- **20 requests per minute**
- **1,000 requests per day** (with ≥$10 credits)
- **50 requests per day** (with <$10 credits)

The system automatically enforces these limits and will wait when needed.

## Current Status

⏳ **Waiting for API key to be added**

Once you add your OpenRouter API key and restart the server, the chat will be fully functional!
