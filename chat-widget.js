// Chat Widget with Secure API Integration via Vercel Serverless Functions
// Fixed: retry logic, timeout UX, message deduplication, better error handling

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
let recordedMimeType = 'audio/webm';
let isSending = false; // ← prevents double-sends while waiting for response

// ─── Pick the best mimeType the current browser actually supports ─────────────
function getSupportedMimeType() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4;codecs=mp4a',
        'audio/mp4',
    ];
    for (const type of candidates) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
}

// ─── Toggle chat window ───────────────────────────────────────────────────────
chatToggle.addEventListener('click', () => {
    chatWindow.classList.toggle('hidden');
    chatIcon.classList.toggle('hidden');
    closeIcon.classList.toggle('hidden');
});

// ─── Send on button click ─────────────────────────────────────────────────────
sendButton.addEventListener('click', () => {
    if (isSending) return;
    const message = chatInput.value.trim();
    if (message) {
        sendMessage(message);
        chatInput.value = '';
    }
});

// ─── Send on Enter key ────────────────────────────────────────────────────────
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isSending) {
        const message = chatInput.value.trim();
        if (message) {
            sendMessage(message);
            chatInput.value = '';
        }
    }
});

// ─── Mic button ───────────────────────────────────────────────────────────────
micButton.addEventListener('click', async () => {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
});

// ─── Add message to chat ──────────────────────────────────────────────────────
function addMessage(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function showTypingIndicator() {
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

function removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
}

// ─── Lock / unlock input while waiting for response ───────────────────────────
function setInputLocked(locked) {
    isSending = locked;
    sendButton.disabled = locked;
    chatInput.disabled = locked;
    chatInput.placeholder = locked ? 'Waiting for reply...' : 'Type a message...';
}

// ─── Send message to API with automatic retry ─────────────────────────────────
async function sendMessage(text, { retryCount = 0 } = {}) {
    // Show user message only on first attempt (not retries)
    if (retryCount === 0) {
        addMessage(text, true);
        setInputLocked(true);
    }

    showTypingIndicator();

    // Show a "still thinking" notice after 15s so user knows it's working
    const slowNoticeTimer = retryCount === 0
        ? setTimeout(() => {
            removeTypingIndicator();
            showTypingIndicator(); // refresh position
            // Append a subtle status line under typing indicator
            const notice = document.createElement('div');
            notice.id = 'slow-notice';
            notice.style.cssText = 'font-size:11px;color:#999;text-align:center;padding:2px 0 4px;';
            notice.textContent = 'Still working on it…';
            chatMessages.appendChild(notice);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 15000)
        : null;

    try {
        const controller = new AbortController();
        // Client-side timeout slightly above server timeout so server error wins
        const clientTimeout = setTimeout(() => controller.abort(), 58000);

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                message: text,
                timestamp: new Date().toISOString(),
                sessionId: getSessionId()
            })
        });

        clearTimeout(clientTimeout);
        clearTimeout(slowNoticeTimer);
        document.getElementById('slow-notice')?.remove();
        removeTypingIndicator();

        // ── Parse response ────────────────────────────────────────────────────
        const data = await response.json();

        // Server returned a 5xx but included a user-friendly message — show it
        if (!response.ok) {
            const serverMsg = data?.response || data?.message;
            if (serverMsg) {
                addMessage(serverMsg, false);
            } else if (retryCount < 1) {
                // One silent retry on 5xx with no message
                console.warn(`HTTP ${response.status} — retrying silently`);
                setInputLocked(false);
                await new Promise(r => setTimeout(r, 2500));
                return sendMessage(text, { retryCount: retryCount + 1 });
            } else {
                addMessage("I'm having trouble right now — please try again in a moment.", false);
            }
            setInputLocked(false);
            return;
        }

        const botResponse = data.response || data.message;

        if (botResponse && botResponse.trim()) {
            addMessage(botResponse.trim(), false);
        } else {
            // Empty response — retry once silently
            if (retryCount < 1) {
                console.warn('Empty response received — retrying silently');
                setInputLocked(false);
                await new Promise(r => setTimeout(r, 2000));
                return sendMessage(text, { retryCount: retryCount + 1 });
            }
            addMessage("I didn't catch that — could you send it again?", false);
        }

    } catch (error) {
        clearTimeout(slowNoticeTimer);
        document.getElementById('slow-notice')?.remove();
        removeTypingIndicator();

        const isTimeout = error.name === 'AbortError';
        console.error(`Send error (attempt ${retryCount + 1}):`, error.message);

        if (retryCount < 1 && !isTimeout) {
            // One silent retry on network errors (not timeouts — those need user action)
            console.warn('Network error — retrying silently in 3s');
            setInputLocked(false);
            await new Promise(r => setTimeout(r, 3000));
            return sendMessage(text, { retryCount: retryCount + 1 });
        }

        const userMessage = isTimeout
            ? "I'm taking longer than usual — please try sending your message again."
            : "I ran into a hiccup — please try again in a moment.";
        addMessage(userMessage, false);
    } finally {
        // Always re-enable input when done
        setInputLocked(false);
    }
}

// ─── Get or create session ID ─────────────────────────────────────────────────
function getSessionId() {
    let sessionId = localStorage.getItem('chat_session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('chat_session_id', sessionId);
    }
    return sessionId;
}

// ─── Start recording audio ────────────────────────────────────────────────────
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
        const mimeType = getSupportedMimeType();
        const recorderOptions = mimeType ? { mimeType } : {};
        mediaRecorder = new MediaRecorder(audioStream, recorderOptions);
        recordedMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: recordedMimeType });
            if (audioBlob.size === 0) {
                addMessage('No audio was captured. Please try again.', false);
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = reader.result.split(',')[1];
                await transcribeAudio(base64Audio, recordedMimeType);
            };
        };

        mediaRecorder.start(250);

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

// ─── Stop recording ───────────────────────────────────────────────────────────
function stopRecording() {
    isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (audioStream) audioStream.getTracks().forEach(track => track.stop());

    micButton.classList.remove('recording');
    recordingStatus.classList.add('hidden');
    document.querySelector('.mic-icon').classList.remove('hidden');
    document.querySelector('.mic-recording').classList.add('hidden');

    mediaRecorder = null;
    audioStream = null;
}

// ─── Transcribe audio via serverless function ─────────────────────────────────
async function transcribeAudio(base64Audio, mimeType) {
    try {
        showTypingIndicator();

        const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64Audio, mimeType })
        });

        removeTypingIndicator();

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('Transcription API error:', errData);
            throw new Error(`Transcription error: ${response.status}`);
        }

        const data = await response.json();

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

// ─── Init ─────────────────────────────────────────────────────────────────────
console.log('Chat widget initialized with secure API integration');