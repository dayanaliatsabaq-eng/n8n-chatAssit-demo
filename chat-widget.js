// Chat Widget with Secure API Integration via Vercel Serverless Functions
// API keys are now stored securely in environment variables

// DOM Elements
const chatToggle = document.getElementById('chat-toggle');
const chatWindow = document.getElementById('chat-window');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const recordingStatus = document.getElementById('recording-status');
const chatIcon = document.querySelector('.chat-icon');
const closeIcon = document.querySelector('.close-icon');

// State
let isRecording = false;
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let recordedMimeType = 'audio/webm'; // will be set to actual mimeType at recording time

// ─── Pick the best mimeType the current browser actually supports ───────────
function getSupportedMimeType() {
    const candidates = [
        'audio/webm;codecs=opus',   // Chrome, Edge (best for Deepgram)
        'audio/webm',               // Chrome fallback
        'audio/ogg;codecs=opus',    // Firefox
        'audio/ogg',                // Firefox fallback
        'audio/mp4;codecs=mp4a',    // Safari
        'audio/mp4',                // Safari fallback
    ];
    for (const type of candidates) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return ''; // Let browser decide (last resort)
}

// Toggle chat window
chatToggle.addEventListener('click', () => {
    chatWindow.classList.toggle('hidden');
    chatIcon.classList.toggle('hidden');
    closeIcon.classList.toggle('hidden');
});

// Send message on button click
sendButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
        sendMessage(message);
        chatInput.value = '';
    }
});

// Send message on Enter key
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const message = chatInput.value.trim();
        if (message) {
            sendMessage(message);
            chatInput.value = '';
        }
    }
});

// Microphone button click
micButton.addEventListener('click', async () => {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
});

// Add message to chat
function addMessage(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    // Avoid duplicate indicators
    if (document.getElementById('typing-indicator')) return;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message';
    typingDiv.id = 'typing-indicator';

    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'typing-indicator';
    indicatorDiv.innerHTML = '<span></span><span></span><span></span>';

    typingDiv.appendChild(indicatorDiv);
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Send message to n8n via serverless function
async function sendMessage(text) {
    addMessage(text, true);
    showTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                timestamp: new Date().toISOString(),
                sessionId: getSessionId()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        removeTypingIndicator();

        const botResponse = data.response || data.message || 'I received your message!';
        addMessage(botResponse, false);

    } catch (error) {
        console.error('Error sending message:', error);
        removeTypingIndicator();
        addMessage('Sorry, I encountered an error. Please try again.', false);
    }
}

// Get or create session ID
function getSessionId() {
    let sessionId = localStorage.getItem('chat_session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('chat_session_id', sessionId);
    }
    return sessionId;
}

// Start recording audio
async function startRecording() {
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        audioChunks = [];

        // Detect best supported mimeType BEFORE creating the MediaRecorder
        const mimeType = getSupportedMimeType();
        console.log('Recording with mimeType:', mimeType || '(browser default)');

        const recorderOptions = mimeType ? { mimeType } : {};
        mediaRecorder = new MediaRecorder(audioStream, recorderOptions);

        // Store the mimeType the recorder is actually using
        recordedMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        console.log('MediaRecorder.mimeType (actual):', recordedMimeType);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            // Use the ACTUAL mimeType the recorder used — not a hardcoded guess
            const audioBlob = new Blob(audioChunks, { type: recordedMimeType });
            console.log(`Audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

            if (audioBlob.size === 0) {
                addMessage('No audio was captured. Please try again.', false);
                return;
            }

            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                // Strip the "data:...;base64," prefix — server only needs raw base64
                const base64Audio = reader.result.split(',')[1];
                // Pass the actual mimeType so the server knows what it received
                await transcribeAudio(base64Audio, recordedMimeType);
            };
        };

        mediaRecorder.start(250);

        // Update UI
        isRecording = true;
        micButton.classList.add('recording');
        recordingStatus.classList.remove('hidden');
        document.querySelector('.mic-icon').classList.add('hidden');
        document.querySelector('.mic-recording').classList.remove('hidden');

    } catch (error) {
        console.error('Error starting recording:', error);
        addMessage('Could not access microphone. Please check permissions.', false);
    }
}

// Stop recording
function stopRecording() {
    isRecording = false;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
    }

    // Update UI
    micButton.classList.remove('recording');
    recordingStatus.classList.add('hidden');
    document.querySelector('.mic-icon').classList.remove('hidden');
    document.querySelector('.mic-recording').classList.add('hidden');

    mediaRecorder = null;
    audioStream = null;
}

// Transcribe audio using serverless function
async function transcribeAudio(base64Audio, mimeType) {
    try {
        showTypingIndicator();

        const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio: base64Audio,
                mimeType: mimeType  // ← NOW we tell the server what format it is
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('Transcription API error:', errData);
            throw new Error(`Transcription error! status: ${response.status}`);
        }

        const data = await response.json();
        removeTypingIndicator();

        if (data.transcript && data.transcript.trim()) {
            sendMessage(data.transcript.trim());
        } else {
            addMessage('Could not understand audio. Please speak clearly and try again.', false);
        }

    } catch (error) {
        console.error('Transcription error:', error);
        removeTypingIndicator();
        addMessage('Error transcribing audio. Please try again.', false);
    }
}

// Initialize
console.log('Chat widget initialized with secure API integration');