# UMak AI Assistant

The UMak AI Assistant is a web-based conversational platform for the
University of Makati. It helps students and university stakeholders find
official information about programs, enrollment, scholarships, tuition/token
fee exemptions, colleges, offices, campus locations, and student services.

## Core value proposition

Users can ask questions in natural language and receive fast, source-grounded
answers without manually searching through multiple university documents. The
assistant only has access to the official UMak text documents included in its
knowledge base. If a requested detail is not available there, the assistant
should say so rather than present unsupported information.

## Features

- UMak-themed responsive landing page with animations, video, and branded
  imagery.
- Conversational chat interface with suggested questions and recent history.
- Keyword-based retrieval from official UMak source documents.
- Direct handling for program offerings, program requirements, college lists,
  and campus or office locations.
- Guidance for scholarships and tuition/token fee exemption procedures.
- Markdown-style formatting for paragraphs, lists, bold text, and tables.
- Loading states, custom scrolling, and responsive chat layout.
- Health-check endpoint for deployment verification.

## Project structure

```text
.
├── backend/
│   ├── server.js              # Express server, retrieval, and Groq integration
│   ├── package.json           # Backend scripts and dependencies
│   ├── package-lock.json      # Locked dependency versions
│   ├── sourcesBOT/            # Official UMak source documents
│   ├── .gitignore             # Keeps .env and node_modules untracked
│   └── .env                  # Local secrets; never commit this file
├── frontend/
│   ├── index.html             # Public landing page
│   ├── chatBot.html           # Assistant page
│   ├── js/chat.js             # Chat UI, formatting, and API client
│   ├── css/style.css          # Landing page and chat styles
│   └── assets/                # Images, video, and other media
└── README.md
```

## Technology stack

- HTML5, CSS3, and vanilla JavaScript
- Node.js with ES modules
- Express
- Groq SDK
- dotenv
- CORS for local development
- Render for production deployment

## Local setup

### Requirements

- Node.js 18 or newer
- npm
- A Groq API key

### Configure environment variables

Create `backend/.env` locally:

```env
GROQ_API_KEY=your_new_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
PORT=5000
```

`GROQ_MODEL` and `PORT` are optional. The defaults are
`openai/gpt-oss-120b` and `5000`.

Never commit `.env` or place the API key in frontend code.

### Install and run

```bash
cd backend
npm install
npm run dev
```

The backend runs at `http://127.0.0.1:5000`.

For local development, the frontend may be opened through VS Code Live Server.
When served from `localhost` or `127.0.0.1`, the chat client calls the local
backend at `http://127.0.0.1:5000/api/ask`.

## Production deployment

The application is deployed as one Render Web Service. Express serves the
static frontend and the API from the same origin.

Render settings:

| Setting | Value |
|---|---|
| Branch | `try-deploy` |
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |

Required Render environment variables:

```text
GROQ_API_KEY=your_new_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
NODE_ENV=production
```

Render supplies the production `PORT` automatically.

The production frontend calls `/api/ask` on the same domain. The previous
lowercase `/chatbot.html` URL redirects to the correctly cased
`/chatBot.html` path for compatibility with older links and Linux hosts.

## Knowledge base and retrieval

The backend loads `.txt` files from `backend/sourcesBOT` when it starts. The
directory name is case-sensitive on Linux-based deployment hosts.

The retrieval flow is:

1. Load the official UMak text documents.
2. Split each document into paragraph-based chunks.
3. Normalize singular/plural and common verb forms, expand common wording
   variants, and rank chunks against the user's question.
4. Include relevant neighboring chunks to preserve context.
5. Send the selected context, conversation history, and question to Groq.
6. Render the returned answer in the chat interface.

Some structured requests, including college lists, program offerings,
requirements, campus locations, the university president, and selected office
leaders are handled directly from the loaded documents before an AI request is
made. This provides deterministic answers for high-value factual questions
while keeping the general retrieval flow available for broader requests.

To update the assistant's information, add or edit official `.txt` files in
`backend/sourcesBOT`, then restart or redeploy the backend.

## API reference

### `GET /api/health`

Returns the backend status and configured model:

```bash
curl http://127.0.0.1:5000/api/health
```

### `POST /api/ask`

Accepts a question and optional conversation history:

```json
{
  "question": "What are the colleges in UMak?",
  "history": [
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "assistant",
      "content": "How can I help you?"
    }
  ]
}
```

Successful responses have this shape:

```json
{
  "answer": "..."
}
```

The endpoint returns `400` for an invalid question and `500` when the AI
request cannot be completed.

## Demonstration questions

These questions match information currently represented in the knowledge base:

- `What are the colleges in UMak?`
- `What programs are offered by CCIS?`
- `What are the requirements for Computer Science?`
- `How do I apply for a tuition or token-fee exemption?`
- `How about for graduate students?`
- `Where is the Information Technology Center?`

The assistant should clearly state when a specific detail, such as an exact
future enrollment date, is not included in the available official documents.

## Security and accuracy

- Keep `GROQ_API_KEY` only in local or Render environment variables.
- Do not commit `backend/.env`.
- Do not place secrets in frontend files.
- Review source documents before using answers for official guidance.
- The assistant is a document-grounded information tool; it does not replace
  official university offices or staff.

## Development commands

Run these commands from `backend`:

```bash
npm install       # Install dependencies
npm start         # Start the production-style server
npm run dev       # Start the watch-mode development server
```

There is currently no automated test suite or frontend build command.
