// Vercel Serverless Function - Deepgram Transcription Proxy
// This function securely handles Deepgram API calls without exposing the API key

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
        const { audio } = req.body;

        if (!audio) {
            return res.status(400).json({ error: 'Audio data is required' });
        }

        // Get Deepgram API key from environment variable
        const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

        if (!deepgramApiKey) {
            console.error('DEEPGRAM_API_KEY not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Convert base64 back to binary buffer for Deepgram
        const audioBuffer = Buffer.from(audio, 'base64');

        // Call Deepgram API - send raw binary, NOT json with a url field
        const deepgramUrl = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&language=en';

        const response = await fetch(deepgramUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${deepgramApiKey}`,
                'Content-Type': 'audio/webm',
            },
            body: audioBuffer
        });

        if (!response.ok) {
            throw new Error(`Deepgram API error: ${response.status}`);
        }

        const data = await response.json();

        // Extract transcript
        const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

        return res.status(200).json({
            transcript,
            success: true
        });

    } catch (error) {
        console.error('Transcription error:', error);
        return res.status(500).json({
            error: 'Transcription failed',
            message: error.message
        });
    }
}