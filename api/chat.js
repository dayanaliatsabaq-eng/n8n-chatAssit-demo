// Vercel Serverless Function - n8n Webhook Proxy
// Fixed: timeout handling, retry logic, robust response parsing

export const maxDuration = 60;

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
        // Increase response timeout limit
        responseLimit: false,
    },
};

// ─── Helper: fetch with a manual timeout ──────────────────────────────────────
async function fetchWithTimeout(url, options, timeoutMs = 55000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

// ─── Helper: fetch with retry on transient errors ─────────────────────────────
async function fetchWithRetry(url, options, { retries = 2, delayMs = 2000, timeoutMs = 55000 } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, options, timeoutMs);
            // Only retry on server errors (5xx), not client errors (4xx)
            if (response.status >= 500 && attempt < retries) {
                const text = await response.text();
                console.warn(`Attempt ${attempt} got ${response.status}, retrying in ${delayMs}ms. Body: ${text.substring(0, 200)}`);
                await new Promise(r => setTimeout(r, delayMs));
                continue;
            }
            return response;
        } catch (err) {
            lastError = err;
            const isTimeout = err.name === 'AbortError';
            console.warn(`Attempt ${attempt} failed (${isTimeout ? 'TIMEOUT' : err.message})`);
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
    }
    throw lastError || new Error('All retry attempts failed');
}

// ─── Helper: robustly extract response text from any n8n payload shape ────────
function extractResponseText(data) {
    const candidates = Array.isArray(data) ? data : [data];
    for (const item of candidates) {
        if (!item || typeof item !== 'object') continue;
        const direct = item.response || item.output || item.text || item.message || item.answer;
        if (direct && typeof direct === 'string' && direct.trim()) return direct.trim();
        const nested =
            item?.json?.response ||
            item?.json?.output ||
            item?.json?.text ||
            item?.data?.response ||
            item?.data?.output ||
            item?.body?.response;
        if (nested && typeof nested === 'string' && nested.trim()) return nested.trim();
    }
    return null;
}

// ─── Helper: extract suggestions array from n8n payload ───────────────────────
function extractSuggestions(data) {
    const candidates = Array.isArray(data) ? data : [data];
    for (const item of candidates) {
        if (!item || typeof item !== 'object') continue;
        const s = item.suggestions || item?.json?.suggestions || item?.data?.suggestions;
        if (Array.isArray(s)) {
            return s.map(String).filter(Boolean).slice(0, 3); // 0–3 chips
        }
    }
    return [];
}


export default async function handler(req, res) {
    // ── CORS ──────────────────────────────────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // ── Parse body ────────────────────────────────────────────────────────
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); }
            catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
        }

        const { message, timestamp, sessionId } = body || {};
        if (!message) return res.status(400).json({ error: 'Message is required' });

        // ── Config ────────────────────────────────────────────────────────────
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (!n8nWebhookUrl) {
            console.error('N8N_WEBHOOK_URL not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // ── Call n8n with retry + timeout ─────────────────────────────────────
        const n8nResponse = await fetchWithRetry(
            n8nWebhookUrl,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    timestamp: timestamp || new Date().toISOString(),
                    sessionId: sessionId || 'unknown'
                })
            },
            {
                retries: 2,       // 1 initial attempt + 1 retry
                delayMs: 2000,    // wait 2s before retry
                timeoutMs: 55000  // 55s per attempt (leaves 5s buffer under Vercel's 60s limit)
            }
        );

        // ── Read raw text so we can log it if anything goes wrong ─────────────
        const rawText = await n8nResponse.text();

        if (!n8nResponse.ok) {
            console.error(`n8n returned HTTP ${n8nResponse.status}:`, rawText.substring(0, 500));
            throw new Error(`n8n webhook error: ${n8nResponse.status}`);
        }

        // ── Parse JSON ────────────────────────────────────────────────────────
        let data;
        try {
            data = JSON.parse(rawText);
        } catch {
            console.error('n8n returned non-JSON. Raw:', rawText.substring(0, 500));
            throw new Error('Invalid JSON from n8n');
        }

        // ── Extract response text (handles all n8n payload shapes) ────────────
        const responseText = extractResponseText(data);

        if (!responseText) {
            console.error('Could not find response text in n8n payload:', JSON.stringify(data).substring(0, 500));
            throw new Error('No response text found in n8n payload');
        }

        // ── Extract suggestions (optional) ────────────────────────────────────
        const suggestions = extractSuggestions(data);

        // ── Determine sessionId to echo back ──────────────────────────────────
        const payload = Array.isArray(data) ? data[0] : data;
        const returnedSessionId = payload?.sessionId || payload?.json?.sessionId || sessionId;

        return res.status(200).json({
            response: responseText,   // for your API / logs
            output: responseText,     // 👈 for the chat widget
            text: responseText,       // 👈 extra safety
            suggestions,
            sessionId: returnedSessionId,
            timestamp: payload?.timestamp || new Date().toISOString()
        });

    } catch (error) {
        const isTimeout = error.name === 'AbortError' || error.message?.includes('abort');
        console.error('Chat API error:', error.message);

        // Return a user-friendly message based on what actually went wrong
        const userMessage = isTimeout
            ? "I'm taking a bit longer than usual — please send your message again."
            : "I ran into a hiccup, please try again in a moment.";

        return res.status(500).json({
            error: 'Failed to process message',
            message: error.message,
            response: userMessage
        });
    }
}