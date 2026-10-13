/**
 * UMak AI Assistant - Complete Frontend Chat Controller
 * Captures user queries, communicates with the Express Gemini backend,
 * and dynamically renders user, loading, and bot message bubbles.
 */

document.addEventListener('DOMContentLoaded', () => {
   // -------------------------------------------------------------------------
    // 1. DOM Element References
    // -------------------------------------------------------------------------
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('chat-messages-container');
    const contentWrapper = document.getElementById('chat-content-wrapper'); // Actual scrollable container
    const greetingContainer = document.getElementById('greeting-container');
    const suggestionChipsContainer = document.getElementById('suggestion-chips');
    const chips = document.querySelectorAll('.chip');

   // Dynamic Backend URL resolution:
    // If testing on localhost/127.0.0.1, it sends to port 5000.
    // If in GitHub Codespaces preview, it replaces the port token in the URL.
    // Dynamic Backend URL resolution:
    // Handles 127.0.0.1/localhost AND any dynamic Codespaces port (5500, 5501, 8000, etc.)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const BACKEND_URL = isLocalhost
        ? 'http://127.0.0.1:5000/api/ask'
        : `${window.location.origin.replace(/-\d+\.app\.github\.dev/, '-5000.app.github.dev')}/api/ask`;

    console.log('🔗 Target Backend API URL:', BACKEND_URL);

    let isFirstMessage = true;
    let isWaitingForResponse = false;
    let conversationHistory = [];
    const MAX_CONVERSATION_MESSAGES = 12;

    // Timer tracker for the dynamic loading status
    let loadingStatusInterval = null;

    // Dynamic stages to cycle through while awaiting the backend
    const LOADING_STAGES = [
        'Checking official campus documents...',
        'Searching university records...',
        'Analyzing inquiry details...',
        'Synthesizing verified guidance...',
        'Finalizing response...'
    ];

    // -------------------------------------------------------------------------
    // 2. UI State Management
    // -------------------------------------------------------------------------
    function prepareChatView() {
        if (isFirstMessage) {
            contentWrapper.classList.add('has-messages');
            if (greetingContainer) greetingContainer.style.display = 'none';
            if (suggestionChipsContainer) suggestionChipsContainer.style.display = 'none';
            isFirstMessage = false;
        }
    }

    function toggleInputState(disabled) {
        isWaitingForResponse = disabled;
        if (chatInput) {
            chatInput.disabled = disabled;
            if (!disabled) chatInput.focus();
        }
        if (sendBtn) {
            sendBtn.disabled = disabled;
            sendBtn.style.opacity = disabled ? '0.5' : '1';
            sendBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
    }

    // Scrolls the true overflow container to the bottom
    function scrollToBottom() {
        if (contentWrapper) {
            // Smoothly move the scroll container to its maximum height
            contentWrapper.scrollTo({
                top: contentWrapper.scrollHeight,
                behavior: 'smooth'
            });
        }
    }
    // -------------------------------------------------------------------------
    // 3. Message Bubble Rendering Functions
    // -------------------------------------------------------------------------
    function appendUserMessage(text) {
        prepareChatView();

        const messageRow = document.createElement('div');
        messageRow.className = 'chat-message-row user-row';
        messageRow.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 1.25rem; width: 100%;';

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble user-bubble';
        bubble.textContent = text;
        bubble.style.cssText = `
            background-color: #2563eb;
            color: #ffffff;
            padding: 0.9rem 1.35rem;
            border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
            max-width: 75%;
            font-size: 1rem;
            line-height: 1.65;
            word-break: break-word;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25);
        `;

        messageRow.appendChild(bubble);
     messagesContainer.appendChild(messageRow);

    // Keep scrolling inside the chat panel so the conversation can move upward freely.
    scrollToBottom();
    }

    // Dynamic Loading Bubble with cycling status texts
    function showLoadingBubble() {
        // Clear any lingering interval before starting a new one
        if (loadingStatusInterval) {
            clearInterval(loadingStatusInterval);
            loadingStatusInterval = null;
        }

        const loadingRow = document.createElement('div');
        loadingRow.id = 'bot-loading-bubble';
        loadingRow.style.cssText = 'display: flex; justify-content: flex-start; margin-bottom: 1.25rem; width: 100%;';

        const bubble = document.createElement('div');
        bubble.style.cssText = `
            background-color: #0f2042;
            color: #93c5fd;
            border: 1px solid #1e3a8a;
            padding: 0.75rem 1.25rem;
            border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
            font-size: 0.9rem;
            display: inline-flex;
            align-items: center;
            gap: 0.6rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25);
        `;

        // Spinner icon
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-circle-notch fa-spin';

        // Animated status text
        const textSpan = document.createElement('span');
        textSpan.id = 'loading-status-text';
        textSpan.style.cssText = 'transition: opacity 0.2s ease;';
        textSpan.textContent = LOADING_STAGES[0];

        bubble.appendChild(icon);
        bubble.appendChild(textSpan);
        loadingRow.appendChild(bubble);
        messagesContainer.appendChild(loadingRow);

        scrollToBottom();

        // Cycle through status messages every 1.3 seconds
        let stageIndex = 0;
        loadingStatusInterval = setInterval(() => {
            stageIndex = (stageIndex + 1) % LOADING_STAGES.length;
            textSpan.style.opacity = '0';
            setTimeout(() => {
                textSpan.textContent = LOADING_STAGES[stageIndex];
                textSpan.style.opacity = '1';
            }, 180);
        }, 1300);
    }

    // Stops the timer and removes the loading bubble
    function removeLoadingBubble() {
        if (loadingStatusInterval) {
            clearInterval(loadingStatusInterval);
            loadingStatusInterval = null;
        }
        const loader = document.getElementById('bot-loading-bubble');
        if (loader) loader.remove();
    }

        function cleanAssistantText(text) {
                return text
                        // Convert keycap emoji numbers such as 1️⃣ back to ordinary numbers.
                        .replace(/([0-9#*])\uFE0F?\u20E3/gu, '$1')
                        // Remove remaining emoji characters from assistant output.
                        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
                        // Remove Markdown horizontal rules and excess blank lines.
                        .replace(/^\s*(?:[-*_]\s*){3,}$/gm, '')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();
        }

        // Helper to convert Markdown (bold, bullets, newlines) into HTML
function formatMarkdown(text) {
  if (!text) return '';
    text = cleanAssistantText(text);

  // 1. If marked.js CDN is loaded in chatBot.html, let it handle full markdown
  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    return marked.parse(text);
  }

  // 2. Built-in zero-dependency fallback parser
  let html = text
    // Escape basic HTML characters to keep it secure
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Convert bold: **text** -> <strong>text</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Convert italic: *text* -> <em>text</em>
    .replace(/(^|[^*])\*(?!\*)(.*?)\*/g, '$1<em>$2</em>')
    // Convert bullet points: "- item" or "* item" into bulleted rows
    .replace(/(?:^|\n)[-*]\s+(.+)/g, '<div style="margin-left: 1rem; text-indent: -0.75rem;">• $1</div>')
    // Convert newlines into line breaks
    .replace(/\n/g, '<br>');

  return html;
}

    // AI assistant response bubble
    function appendBotMessage(answerText, isError = false) {
    removeLoadingBubble();

    const messageRow = document.createElement('div');
    messageRow.className = 'chat-message-row bot-row';
    messageRow.style.cssText = 'display: flex; justify-content: flex-start; margin-bottom: 1.25rem; width: 100%;';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot-bubble';
    bubble.style.cssText = `
        background-color: ${isError ? '#450a0a' : '#0d1e3a'};
        color: ${isError ? '#fca5a5' : '#e2e8f0'};
        border: 1px solid ${isError ? '#991b1b' : '#1e3a8a'};
        padding: 1rem 1.25rem;
        border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
        max-width: 78%;
        font-size: 1rem;
        line-height: 1.75;
        word-break: break-word;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    `;

    // Verification header badge
    const badge = document.createElement('div');
    badge.style.cssText = `
        font-size: 0.75rem;
        font-weight: 700;
        color: ${isError ? '#ef4444' : '#34d399'};
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    `;

    // Optional: keep badge text if your original code had it
    badge.textContent = isError ? 'Error' : 'UMak Assistant';

    const body = document.createElement('div');
    body.style.cssText = 'line-height: 1.75; font-family: inherit;';

    // Apply parsed Markdown formatting here instead of raw textContent
    body.innerHTML = formatMarkdown(answerText);

    bubble.appendChild(badge);
    bubble.appendChild(body);
    messageRow.appendChild(bubble);
    messagesContainer.appendChild(messageRow);

    scrollToBottom();
    }

    // -------------------------------------------------------------------------
    // 4. API Client (fetch)
    // -------------------------------------------------------------------------
    async function fetchAssistantResponse(questionText) {
        showLoadingBubble();
        toggleInputState(true);

        // Allow 90 seconds for local CPU inference in Codespaces
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        try {
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: questionText,
                    history: conversationHistory,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Server responded with status ${response.status}`);
            }

            const answer = data.answer || 'No answer provided by the model.';
            conversationHistory = [
                ...conversationHistory,
                { role: 'user', content: questionText },
                { role: 'assistant', content: answer },
            ].slice(-MAX_CONVERSATION_MESSAGES);

            appendBotMessage(answer);
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Fetch error:', error);
            
            const message = error.name === 'AbortError'
                ? 'The request took a little too long to respond. Please try asking again.'
                : 'Unable to reach the assistant server. Please confirm the backend is running on port 5000.';
                
            appendBotMessage(message, true);
        } finally {
            toggleInputState(false);
        }
    }
    
    // -------------------------------------------------------------------------
    // 5. Central Submission Handler
    // -------------------------------------------------------------------------
    function handleUserSubmission(queryText) {
        if (isWaitingForResponse) return;

        const text = queryText !== undefined ? queryText : chatInput.value;
        const cleanText = text.trim();

        if (!cleanText) return;

        appendUserMessage(cleanText);
        chatInput.value = '';

        fetchAssistantResponse(cleanText);
    }

    // -------------------------------------------------------------------------
    // 6. Event Listeners
    // -------------------------------------------------------------------------
    if (sendBtn) {
        sendBtn.addEventListener('click', () => handleUserSubmission());
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleUserSubmission();
            }
        });
    }

    chips.forEach((chip) => {
        chip.addEventListener('click', () => {
            const query = chip.getAttribute('data-query') || chip.textContent;
            handleUserSubmission(query);
        });
    });
});
