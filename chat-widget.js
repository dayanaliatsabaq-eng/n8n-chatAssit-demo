// Chat Widget — Enhanced with AI Suggestion Chips
// Secure API via Vercel Serverless Functions

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const chatToggle = document.getElementById('chat-toggle');
const chatWindow = document.getElementById('chat-window');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const recordingStatus = document.getElementById('recording-status');
const chatIcon = document.querySelector('.chat-icon');
const closeIcon = document.querySelector('.close-icon');

// ─── State ─────────────────────────────────────────────────────────────────────
let isRecording = false;
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let recordedMimeType = 'audio/webm';
let activeRequests = 0;

// ─── Message counter (used to pick context-appropriate fallback chips) ─────────
let messageCount = 0;

// ─── Fallback chips — contextual 2–3 chips when n8n returns none ───────────────
function getContextualFallbacks() {
    if (messageCount <= 1) {
        // Opening — help the user explore
        return ['What do you offer?', 'How can you help me?'];
    } else if (messageCount <= 3) {
        // Early conversation — surface key actions
        return ['Tell me more', 'Get a quote', 'How does it work?'];
    } else {
        // Mid/late conversation — push toward conversion
        return ['Talk to a human', 'Get in touch'];
    }
}

// ─── Audio MIME type detection ─────────────────────────────────────────────────
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

// ─── Toggle chat window ────────────────────────────────────────────────────────
chatToggle.addEventListener('click', () => {
    chatWindow.classList.toggle('hidden');
    chatIcon.classList.toggle('hidden');
    closeIcon.classList.toggle('hidden');
});

// ─── Hook initial suggestion chips ────────────────────────────────────────────
document.querySelectorAll('#initial-suggestions .suggestion-chip').forEach(btn => {
    btn.addEventListener('click', () => handleSuggestionClick(btn));
});

// ─── Send on button click ──────────────────────────────────────────────────────
sendButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
        sendMessage(message);
        chatInput.value = '';
    }
});

// ─── Send on Enter ─────────────────────────────────────────────────────────────
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const message = chatInput.value.trim();
        if (message) {
            sendMessage(message);
            chatInput.value = '';
        }
    }
});

// ─── Mic button ────────────────────────────────────────────────────────────────
micButton.addEventListener('click', async () => {
    if (!isRecording) await startRecording();
    else stopRecording();
});

// ─── Add a message bubble ──────────────────────────────────────────────────────
function addMessage(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    return messageDiv;
}

// ─── Render AI suggestion chips after a bot message ───────────────────────────
function renderSuggestions(suggestions) {
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) return;

    const container = document.createElement('div');
    container.className = 'suggestions-container';

    suggestions.forEach(text => {
        const chip = document.createElement('button');
        chip.className = 'suggestion-chip';
        chip.textContent = text;
        chip.addEventListener('click', () => handleSuggestionClick(chip));
        container.appendChild(chip);
    });

    chatMessages.appendChild(container);
    scrollToBottom();
}

// ─── Suggestion chip click handler ────────────────────────────────────────────
function handleSuggestionClick(chip) {
    const text = chip.textContent.trim();

    // Mark all chips in this group as used
    const siblings = chip.closest('.suggestions-container');
    if (siblings) {
        siblings.querySelectorAll('.suggestion-chip').forEach(c => c.classList.add('used'));
    }

    sendMessage(text);
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function showTypingIndicator() {
    if (document.getElementById('typing-indicator')) return;
    const div = document.createElement('div');
    div.className = 'message bot-message';
    div.id = 'typing-indicator';
    div.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(div);
    scrollToBottom();
}

function removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
}

// ─── Lock / unlock input ───────────────────────────────────────────────────────
function setInputLocked(locked) {
    // We no longer lock the input field to allow concurrent messaging
    sendButton.disabled = false;
    chatInput.disabled = false;
    chatInput.placeholder = 'Ask anything…';
}

// ─── Scroll helper ─────────────────────────────────────────────────────────────
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── Send message with retry logic ────────────────────────────────────────────
async function sendMessage(text, { retryCount = 0 } = {}) {
    if (retryCount === 0) {
        addMessage(text, true);
        activeRequests++;
    }

    showTypingIndicator();

    // Show "still thinking" notice after 15s
    const slowNoticeTimer = retryCount === 0
        ? setTimeout(() => {
            const notice = document.createElement('div');
            notice.id = 'slow-notice';
            notice.style.cssText = 'font-size:11px;color:#999;text-align:center;padding:2px 0 4px;';
            notice.textContent = 'Still working on it…';
            chatMessages.appendChild(notice);
            scrollToBottom();
        }, 15000)
        : null;

    try {
        const controller = new AbortController();
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

        activeRequests = Math.max(0, activeRequests - 1);
        if (activeRequests === 0) {
            removeTypingIndicator();
        }

        const data = await response.json();

        if (!response.ok) {
            const serverMsg = data?.response || data?.message;
            if (serverMsg) {
                addMessage(serverMsg, false);
            } else if (retryCount < 1) {
                activeRequests++; // Re-increment for the retry
                await delay(2500);
                return sendMessage(text, { retryCount: retryCount + 1 });
            } else {
                addMessage("I'm having trouble right now — please try again in a moment.", false);
            }
            return;
        }

        const botResponse = data.response || data.message;
        if (botResponse && botResponse.trim()) {
            messageCount++;
            addMessage(botResponse.trim(), false);
            // Render AI suggestion chips — fall back to contextual defaults if n8n returns none
            const chips = (Array.isArray(data.suggestions) && data.suggestions.length > 0)
                ? data.suggestions
                : getContextualFallbacks();
            renderSuggestions(chips);
        } else if (retryCount < 1) {
            activeRequests++; // Re-increment for the retry
            await delay(2000);
            return sendMessage(text, { retryCount: retryCount + 1 });
        } else {
            addMessage("I didn't catch that — could you send it again?", false);
        }

    } catch (error) {
        clearTimeout(slowNoticeTimer);
        document.getElementById('slow-notice')?.remove();
        removeTypingIndicator();

        const isTimeout = error.name === 'AbortError';
        console.error(`Send error (attempt ${retryCount + 1}):`, error.message);

        if (retryCount < 1 && !isTimeout) {
            activeRequests++; // Re-increment for the retry
            await delay(3000);
            return sendMessage(text, { retryCount: retryCount + 1 });
        }

        addMessage(
            isTimeout
                ? "I'm taking longer than usual — please try sending again."
                : "I ran into a hiccup — please try again in a moment.",
            false
        );
    }
}

// ─── Utility: promise-based delay ──────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Session ID ────────────────────────────────────────────────────────────────
function getSessionId() {
    let id = localStorage.getItem('chat_session_id');
    if (!id) {
        id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('chat_session_id', id);
    }
    return id;
}

// ─── Start recording ───────────────────────────────────────────────────────────
async function startRecording() {
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        audioChunks = [];
        const mimeType = getSupportedMimeType();
        mediaRecorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : {});
        recordedMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';

        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: recordedMimeType });
            if (blob.size === 0) { addMessage('No audio captured. Please try again.', false); return; }
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                await transcribeAudio(reader.result.split(',')[1], recordedMimeType);
            };
        };

        mediaRecorder.start(250);
        isRecording = true;
        micButton.classList.add('recording');
        recordingStatus.classList.remove('hidden');
        document.querySelector('.mic-icon').classList.add('hidden');
        document.querySelector('.mic-recording').classList.remove('hidden');

    } catch (err) {
        console.error('Mic error:', err);
        addMessage('Could not access microphone. Please check permissions.', false);
    }
}

// ─── Stop recording ────────────────────────────────────────────────────────────
function stopRecording() {
    isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (audioStream) audioStream.getTracks().forEach(t => t.stop());
    micButton.classList.remove('recording');
    recordingStatus.classList.add('hidden');
    document.querySelector('.mic-icon').classList.remove('hidden');
    document.querySelector('.mic-recording').classList.add('hidden');
    mediaRecorder = null;
    audioStream = null;
}

// ─── Transcribe audio ──────────────────────────────────────────────────────────
async function transcribeAudio(base64Audio, mimeType) {
    try {
        showTypingIndicator();

        const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64Audio, mimeType })
        });

        removeTypingIndicator();

        if (!response.ok) throw new Error(`Transcription error: ${response.status}`);

        const data = await response.json();

        if (data.transcript && data.transcript.trim()) {
            sendMessage(data.transcript.trim());
        } else {
            addMessage('Could not understand audio. Please speak clearly and try again.', false);
        }

    } catch (err) {
        console.error('Transcription error:', err);
        removeTypingIndicator();
        addMessage('Error transcribing audio. Please try again.', false);
    }
}

console.log('🚀 Moonshot chat widget initialised');