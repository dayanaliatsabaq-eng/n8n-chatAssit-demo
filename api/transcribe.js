// Vercel Serverless Function - Deepgram Transcription Proxy
// This function securely handles Deepgram API calls without exposing the API key

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
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

        const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramApiKey) {
            console.error('DEEPGRAM_API_KEY not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Strip data URL prefix if present (e.g. "data:audio/webm;base64,AAAA...")
        let base64Data = audio;
        let detectedMimeType = mimeType || 'audio/webm;codecs=opus';

        if (typeof audio === 'string' && audio.startsWith('data:')) {
            const matches = audio.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                detectedMimeType = matches[1];
                base64Data = matches[2];
            } else {
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

        // ─── Normalise the Content-Type for Deepgram ──────────────────────────
        // Browsers append codec info: "audio/webm;codecs=opus"
        // Deepgram only wants the base type: "audio/webm"
        // We also remap any aliases Deepgram doesn't accept.
        const baseType = detectedMimeType.split(';')[0].trim().toLowerCase();

        const mimeMap = {
            'audio/x-m4a': 'audio/mp4',
            'audio/mpeg': 'audio/mp3',
            'video/webm': 'audio/webm',  // Chrome sometimes tags recordings as video/webm
            'video/mp4': 'audio/mp4',
        };

        const contentType = mimeMap[baseType] || baseType;

        console.log(`Transcribing ${audioBuffer.length} bytes | raw mimeType: "${detectedMimeType}" | sending as: "${contentType}"`);

        // Call Deepgram
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
            throw new Error(`Deepgram API error: ${deepgramResponse.status} - ${rawText.slice(0, 300)}`);
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch {
            console.error('Failed to parse Deepgram response:', rawText);
            throw new Error('Invalid JSON from Deepgram');
        }

        const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

        if (!transcript) {
            console.warn('Deepgram returned empty transcript. Full response:', JSON.stringify(data));
        }

        return res.status(200).json({ transcript, success: true });

    } catch (error) {
        console.error('Transcription error:', error.message);
        return res.status(500).json({
            error: 'Transcription failed',
            message: error.message
        });
    }
}