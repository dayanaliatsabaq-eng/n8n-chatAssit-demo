// Vercel Serverless Function - n8n Webhook Proxy
// This function securely handles n8n webhook calls without exposing the webhook URL

export const maxDuration = 60;

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

export default async function handler(req, res) {
    // Enable CORS on every response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight FIRST - before any method checks
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Safely parse body — Vercel sometimes delivers it as a string
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch {
                return res.status(400).json({ error: 'Invalid JSON body' });
            }
        }

        const { message, timestamp, sessionId } = body || {};

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get n8n webhook URL from environment variable
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

        if (!n8nWebhookUrl) {
            console.error('N8N_WEBHOOK_URL not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Forward request to n8n webhook
        const n8nResponse = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                timestamp: timestamp || new Date().toISOString(),
                sessionId: sessionId || 'unknown'
            })
        });

        // Read raw text first so we can log it if JSON parsing fails
        const rawText = await n8nResponse.text();

        if (!n8nResponse.ok) {
            console.error(`n8n webhook returned ${n8nResponse.status}:`, rawText);
            throw new Error(`n8n webhook error: ${n8nResponse.status}`);
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseErr) {
            console.error('Failed to parse n8n response as JSON. Raw response:', rawText);
            throw new Error('Invalid JSON response from n8n');
        }

        // n8n wraps its response in an array e.g. [{ response: "...", sessionId: "..." }]
        // Unwrap it so the frontend receives a plain object
        const payload = Array.isArray(data) ? data[0] : data;

        if (!payload) {
            console.error('Empty payload from n8n. Raw data:', data);
            throw new Error('Empty response from n8n');
        }

        const responseText = payload.response || payload.output || payload.text || payload.message || null;

        if (!responseText) {
            console.error('No recognizable text field in n8n payload:', payload);
            throw new Error('No response text in n8n payload');
        }

        return res.status(200).json({
            response: responseText,
            sessionId: payload.sessionId || sessionId,
            timestamp: payload.timestamp || new Date().toISOString()
        });

    } catch (error) {
        console.error('n8n webhook error:', error.message);
        return res.status(500).json({
            error: 'Failed to process message',
            message: error.message,
            response: 'Sorry, I encountered an error. Please try again.'
        });
    }
}