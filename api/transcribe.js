// Vercel Serverless Function - Deepgram Transcription Proxy
// This function securely handles Deepgram API calls without exposing the API key

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb', // Audio files can be large
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

        const { audio, mimeType } = body || {};

        if (!audio) {
            return res.status(400).json({ error: 'Audio data is required' });
        }

        // Get Deepgram API key from environment variable
        const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

        if (!deepgramApiKey) {
            console.error('DEEPGRAM_API_KEY not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Strip data URL prefix if the frontend sent a data URL
        // e.g. "data:audio/webm;base64,AAAA..." -> "AAAA..."
        let base64Data = audio;
        let detectedMimeType = mimeType || 'audio/webm';

        if (typeof audio === 'string' && audio.startsWith('data:')) {
            const matches = audio.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                detectedMimeType = matches[1]; // e.g. "audio/webm" or "audio/ogg"
                base64Data = matches[2];
            } else {
                console.error('Malformed data URL received');
                return res.status(400).json({ error: 'Malformed audio data URL' });
            }
        }

        // Convert base64 to binary buffer
        let audioBuffer;
        try {
            audioBuffer = Buffer.from(base64Data, 'base64');
        } catch (bufErr) {
            console.error('Failed to decode base64 audio:', bufErr.message);
            return res.status(400).json({ error: 'Invalid base64 audio data' });
        }

        if (audioBuffer.length === 0) {
            return res.status(400).json({ error: 'Audio buffer is empty after decoding' });
        }

        // Normalize MIME type — Deepgram handles webm, ogg, mp4, wav, etc.
        // Map common aliases to Deepgram-accepted values
        const mimeMap = {
            'audio/x-m4a': 'audio/mp4',
            'audio/mpeg': 'audio/mp3',
            'video/webm': 'audio/webm', // Some browsers record as video/webm
        };
        const contentType = mimeMap[detectedMimeType] || detectedMimeType;

        console.log(`Transcribing ${audioBuffer.length} bytes of ${contentType}`);

        // Call Deepgram API
        const deepgramUrl = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&language=en';

        const deepgramResponse = await fetch(deepgramUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${deepgramApiKey}`,
                'Content-Type': contentType,
            },
            body: audioBuffer
        });

        const rawText = await deepgramResponse.text();

        if (!deepgramResponse.ok) {
            console.error(`Deepgram API error ${deepgramResponse.status}:`, rawText);
            throw new Error(`Deepgram API error: ${deepgramResponse.status} - ${rawText.slice(0, 200)}`);
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch {
            console.error('Failed to parse Deepgram response:', rawText);
            throw new Error('Invalid JSON from Deepgram');
        }

        // Extract transcript
        const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

        if (!transcript) {
            console.warn('Deepgram returned empty transcript. Full response:', JSON.stringify(data));
        }

        return res.status(200).json({
            transcript,
            success: true
        });

    } catch (error) {
        console.error('Transcription error:', error.message);
        return res.status(500).json({
            error: 'Transcription failed',
            message: error.message
        });
    }
}