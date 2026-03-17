# Architecture

## Folder Structure

```
yeetcode/
│
├── app/                          # Next.js App Router — routes only
│   ├── page.tsx                  # Home: difficulty selection
│   ├── layout.tsx                # Root layout (fonts, metadata)
│   ├── globals.css               # Tailwind theme + custom CSS vars
│   ├── playground/
│   │   └── page.tsx              # Interview UI — thin orchestrator (~70 lines)
│   ├── transcription/
│   │   └── page.tsx              # Dev-only debug page for testing the pipeline
│   └── api/transcription/status/
│       └── route.ts              # Proxy to backend status endpoint
│
├── components/                   # Pure UI — no business logic, no fetch calls
│   ├── chat/
│   │   └── ChatWindow.tsx        # Scrollable message list (user/bot bubbles)
│   ├── editor/
│   │   └── TextEditor.tsx        # Writing area with countdown timer + mic status
│   ├── interviewer/
│   │   └── ProfileCard.tsx       # Interviewer avatar with speaking animation
│   ├── modals/
│   │   ├── RulesModal.tsx        # Interview guidelines shown before start
│   │   └── EvaluationModal.tsx   # Score breakdown shown after interview ends
│   └── question/
│       └── QuestionSelector.tsx  # Animated dropdown for question selection
│
├── hooks/                        # All stateful logic — no JSX
│   ├── useWebSocket.ts           # WS connection: connect, send, receive, disconnect
│   ├── useVoiceRecording.ts      # Mic → 3s chunks → VAD → buffer → flush
│   └── useInterview.ts           # Orchestrator: ties WS + voice + messages + eval
│
├── lib/                          # Pure utilities and data — no React
│   ├── types.ts                  # Shared TypeScript interfaces (Message, QuestionData, …)
│   ├── questions.ts              # Static question bank (Easy / Medium / Hard)
│   ├── audioUtils.ts             # detectSpeech (RMS), base64ToBlob, blobsToBase64
│   └── interviewApi.ts           # All fetch() calls: setupInterview, evaluateInterview
│
├── public/                       # Static assets
└── docs/                         # Project documentation
    └── ARCHITECTURE.md           # This file
```

## Layer Rules

| Layer | Can import from | Cannot import from |
|---|---|---|
| `app/` (pages) | `hooks/`, `components/`, `lib/` | — |
| `components/` | `lib/` | `hooks/`, `app/` |
| `hooks/` | `lib/` | `components/`, `app/` |
| `lib/` | nothing | everything above |

This keeps dependencies flowing in one direction. `lib/` is always the bottom.

## Data Flow

```
User picks difficulty
        │
        ▼
app/page.tsx
  └─ lib/interviewApi.ts ──► POST /api/interview/setup
        │
        ▼ redirect
app/playground/page.tsx
  └─ hooks/useInterview.ts
       ├─ hooks/useWebSocket.ts ◄──────────────────────────┐
       │     └─ ws://localhost:8080/ws/transcribe           │
       │                                                    │
       └─ hooks/useVoiceRecording.ts                        │
             └─ lib/audioUtils.ts (detectSpeech)            │
                   │ speech detected                        │
                   └─ base64 audio ──────────────────────────┘
                                     send({ type: 'audio' })

Incoming WS messages:
  'transcript'     → add user message to chat
  'audio_response' → play AI audio + add bot message to chat

On timer expiry:
  lib/interviewApi.ts ──► POST /api/interview/evaluate
        │
        ▼
  components/modals/EvaluationModal.tsx (shows score)
```

## Audio Pipeline (useVoiceRecording)

```
getUserMedia()
      │
      ▼
MediaRecorder (runs in 3-second cycles)
      │
      ▼ every 3s
detectSpeech(blob)  ← lib/audioUtils.ts (RMS energy analysis)
      │
   speech?
   ├─ YES → push to speechBuffer[], restart cycle
   └─ NO  → consecutiveSilence++
              │
              if >= 2 consecutive silences AND buffer not empty:
              └─► blobsToBase64(buffer) → onSpeechReady(base64)
                        │
                        ▼
               useInterview.ts → send({ type: 'audio' }) via WebSocket
```

## Adding New Features

### New UI component
Create `components/<feature>/MyComponent.tsx`. Import types from `@/lib/types` only. No hooks, no fetch.

### New piece of logic
Create `hooks/useMyFeature.ts`. Use `@/lib/` utilities. Return a clean API for pages to consume.

### New API call
Add a function to `lib/interviewApi.ts`. Keep the `BASE_URL` constant there — don't hardcode URLs elsewhere.

### New question
Add an entry to `lib/questions.ts`. The key must match the difficulty level string used in the URL param.

### New shared type
Add to `lib/types.ts`. Import it wherever needed with `@/lib/types`.
