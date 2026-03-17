# YeetCode

An AI-powered mock interview platform. Pick a difficulty, get a coding problem, and do a real-time voice interview with an AI interviewer — then get a scored evaluation at the end.

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS 4** — dark theme with OKLCH color variables
- **Framer Motion** — UI animations
- **WebSockets** — real-time audio streaming
- **Backend** — expects a server at `localhost:8080` (separate repo)

## Getting Started

### Prerequisites

- Node.js 18+
- Backend server running at `localhost:8080`

### Install & Run

```bash
npm install

# HTTP (development)
npm run dev

# HTTPS (required for mic access in most browsers)
npm run dev:https
```

The app runs on `http://localhost:3000` (or `https://localhost:3001` for HTTPS).

### Environment

No `.env` file required by default. Backend URL and WebSocket URL are configured in:
- `lib/interviewApi.ts` — REST API base URL
- `hooks/useWebSocket.ts` — WebSocket URL

## Project Structure

```
app/               # Next.js routes (pages only — keep thin)
components/        # UI components grouped by feature
hooks/             # Custom React hooks (all logic lives here)
lib/               # Types, data, utilities, and API calls
public/            # Static assets
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a full breakdown.

## User Flow

1. **Home (`/`)** — Select difficulty (Easy / Medium / Hard), hit Start Interview
2. **Backend setup** — Question and difficulty sent to backend via REST
3. **Playground (`/playground`)** — Voice interview starts; audio streams over WebSocket
4. **Evaluation** — On timer expiry, conversation is posted to backend for scoring

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
