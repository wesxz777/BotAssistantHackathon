/**
 * UMak AI Assistant - Complete Frontend Chat Controller
 * Captures user queries, communicates with the Express backend,
 * and dynamically renders user, loading, and bot message bubbles.
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // 1. DOM Element References
    // -------------------------------------------------------------------------
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('chat-messages-container');
    const contentWrapper = document.getElementById('chat-content-wrapper');
    const greetingContainer = document.getElementById('greeting-container');
    const suggestionChipsContainer = document.getElementById('suggestion-chips');
    const chips = document.querySelectorAll('.chip');

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const BACKEND_URL = isLocalhost
        ? 'http://127.0.0.1:5000/api/ask'
        : `${window.location.origin.replace(/-\d+\.app\.github\.dev/, '-5000.app.github.dev')}/api/ask`;

    console.log('🔗 Target Backend API URL:', BACKEND_URL);

    let isFirstMessage = true;
    let isWaitingForResponse = false;
    let conversationHistory = [];
    const MAX_CONVERSATION_MESSAGES = 12;

    let loadingStatusInterval = null;

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

    function scrollToBottom() {
        if (contentWrapper) {
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
        scrollToBottom();
    }

    function showLoadingBubble() {
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

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-circle-notch fa-spin';

        const textSpan = document.createElement('span');
        textSpan.id = 'loading-status-text';
        textSpan.style.cssText = 'transition: opacity 0.2s ease;';
        textSpan.textContent = LOADING_STAGES[0];

        bubble.appendChild(icon);
        bubble.appendChild(textSpan);
        loadingRow.appendChild(bubble);
        messagesContainer.appendChild(loadingRow);

        scrollToBottom();

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
            .replace(/([0-9#*])\uFE0F?\u20E3/gu, '$1')
            .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
            .replace(/^\s*(?:[-*_]\s*){3,}$/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // Applies bold/italic formatting within a single line of text
    function applyInlineFormatting(line) {
        return line
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*(?!\*)(.*?)\*/g, '$1<em>$2</em>');
    }

    // Checks if a line looks like a Markdown table row: | cell | cell |
    function isTableRow(line) {
        return /^\|.*\|$/.test(line.trim());
    }

    // Checks if a line is a table separator row like |---|---|
    function isTableSeparator(line) {
        return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line.trim());
    }

    // Converts a block of consecutive "| cell | cell |" lines into an HTML table
    function renderTable(rows) {
        const parseRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

        const headerCells = parseRow(rows[0]);
        const bodyRows = rows.slice(2); // skip header + separator

        let html = '<table><thead><tr>';
        headerCells.forEach((cell) => {
            html += `<th>${applyInlineFormatting(cell)}</th>`;
        });
        html += '</tr></thead><tbody>';

        bodyRows.forEach((row) => {
            const cells = parseRow(row);
            html += '<tr>';
            cells.forEach((cell) => {
                html += `<td>${applyInlineFormatting(cell)}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        return html;
    }

    // Converts the assistant's Markdown-ish answer into HTML.
    // Uses marked.js if it loaded successfully; otherwise falls back to a
    // small built-in parser that handles bold text, bullet lists, and
    // simple Markdown tables.
    function formatMarkdown(text) {
        if (!text) return '';
        text = cleanAssistantText(text);

        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
            return marked.parse(text);
        }

        // Force a line break before every " - " bullet marker, whether or not
        // the model already used a real newline.
        text = text.replace(/\s+-\s+(?=\S)/g, '\n- ');

        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const lines = escaped.split('\n').map((l) => l.trim()).filter(Boolean);

        let html = '';
        let listBuffer = [];
        let tableBuffer = [];

        function flushList() {
            if (listBuffer.length) {
                const items = listBuffer.map((item) => `<li>${applyInlineFormatting(item)}</li>`).join('');
                html += `<ul style="margin: 0.5rem 0; padding-left: 1.25rem;">${items}</ul>`;
                listBuffer = [];
            }
        }

        function flushTable() {
            if (tableBuffer.length >= 2 && isTableSeparator(tableBuffer[1])) {
                html += renderTable(tableBuffer);
            } else if (tableBuffer.length) {
                // Not a real table (no separator row) — just show as paragraphs
                tableBuffer.forEach((row) => {
                    html += `<p style="margin: 0.5rem 0;">${applyInlineFormatting(row)}</p>`;
                });
            }
            tableBuffer = [];
        }

        for (const line of lines) {
            if (isTableRow(line)) {
                flushList();
                tableBuffer.push(line);
                continue;
            }
            flushTable();

            if (/^[-*]\s+/.test(line)) {
                listBuffer.push(line.replace(/^[-*]\s+/, ''));
            } else {
                flushList();
                html += `<p style="margin: 0.5rem 0;">${applyInlineFormatting(line)}</p>`;
            }
        }
        flushList();
        flushTable();

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
        badge.textContent = isError ? 'Error' : 'UMak Assistant';

        const body = document.createElement('div');
        body.style.cssText = 'line-height: 1.75; font-family: inherit;';

        const rawHtml = formatMarkdown(answerText);

        if (typeof DOMPurify !== 'undefined') {
            body.innerHTML = DOMPurify.sanitize(rawHtml);
        } else {
            // formatMarkdown escapes source text before adding the supported
            // formatting, so the fallback HTML is safe to render directly.
            body.innerHTML = rawHtml;
        }

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

            let message;
            if (error.name === 'AbortError') {
                message = 'The request took a little too long to respond. Please try asking again.';
            } else if (error.message && error.message !== 'Failed to fetch') {
                message = error.message;
            } else {
                message = 'Unable to reach the assistant server. Please try again shortly.';
            }

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
        isWaitingForResponse = true;

        const text = queryText !== undefined ? queryText : chatInput.value;
        const cleanText = text.trim();

        if (!cleanText) {
            isWaitingForResponse = false;
            return;
        }

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