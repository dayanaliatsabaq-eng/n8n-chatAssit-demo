// Vercel Serverless Function - n8n Webhook Proxy
// This function securely handles n8n webhook calls without exposing the webhook URL

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { message, timestamp, sessionId } = req.body;

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
        const response = await fetch(n8nWebhookUrl, {
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

        if (!response.ok) {
            throw new Error(`n8n webhook error: ${response.status}`);
        }

        const data = await response.json();

        return res.status(200).json(data);

    } catch (error) {
        console.error('n8n webhook error:', error);
        return res.status(500).json({
            error: 'Failed to process message',
            message: error.message,
            response: 'Sorry, I encountered an error. Please try again.'
        });
    }
}
