import 'dotenv/config';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = 'http://localhost:4321';
const SITE_NAME = 'Test Script';

const VISION_MODELS = [
    'nvidia/nemotron-nano-12b-v2-vl:free', // Corrected VL model ID
    'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF:free', // Checking if this works for text/vision
    'openrouter/free'
];

async function testModel(model) {
    console.log(`Testing ${model}...`);
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": SITE_URL,
                "X-Title": SITE_NAME,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "user", content: "What is in this image? (Test)" }
                ]
            })
        });

        if (response.ok) {
            console.log(`✅ ${model} SUCCESS`);
            const data = await response.json();
            console.log("RAW RESPONSE:", JSON.stringify(data, null, 2)); // Full debug
            if (data.choices && data.choices[0] && data.choices[0].message) {
                console.log("CONTENT:", data.choices[0].message.content);
            }
            return true;
        } else {
            console.error(`❌ ${model} FAILED: ${response.status} - ${await response.text()}`);
            return false;
        }
    } catch (e) {
        console.error(`❌ ${model} ERROR:`, e.message);
        return false;
    }
}

async function run() {
    if (!OPENROUTER_API_KEY) {
        console.error("Missing OPENROUTER_API_KEY");
        return;
    }
    for (const model of VISION_MODELS) {
        await testModel(model);
    }
}

run();
