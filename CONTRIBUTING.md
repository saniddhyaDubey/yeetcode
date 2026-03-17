# Contributing to YeetCode

## Setup

```bash
git clone <repo-url>
cd yeetcode
npm install
npm run dev:https   # mic access requires HTTPS in most browsers
```

You'll also need the backend running at `localhost:8080`. Check the backend repo for setup instructions.

## Project Structure

Before making changes, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The short version:

- **`app/`** — pages only (thin, mostly layout)
- **`components/`** — pure UI, grouped by feature
- **`hooks/`** — all stateful logic
- **`lib/`** — types, data, pure utilities, API calls

## Layer Rules (important)

Dependencies flow **downward only**:

```
app → hooks → lib
app → components → lib
```

- Components never import from hooks
- `lib/` never imports from anywhere in this project
- Never put a `fetch()` call in a component or hook directly — use `lib/interviewApi.ts`

## Making Changes

### Adding a component
1. Create `components/<feature>/MyComponent.tsx`
2. Import shared types from `@/lib/types`
3. Props-only — no internal state that belongs in a hook

### Adding a hook
1. Create `hooks/useMyHook.ts`
2. Add `"use client"` at the top
3. Use `@/lib/` for utilities and types
4. Return a typed object (not an array) so callers have named properties

### Adding an API call
1. Add a new exported function in `lib/interviewApi.ts`
2. Keep the `BASE_URL` constant — don't hardcode URLs elsewhere
3. Type the return value using interfaces from `lib/types.ts`

### Adding a question
Open `lib/questions.ts` and add a new entry. The key must match the difficulty string passed in the URL (`?difficulty=Easy`).

### Adding a type
Add it to `lib/types.ts` and import with `@/lib/types`.

## Code Style

- TypeScript strict mode is enabled — no `any` unless unavoidable
- Use named exports for utilities and hooks; default exports for components (Next.js convention)
- Prefer `const` functions for hooks and utilities
- Keep page files under ~100 lines — move logic to hooks if they grow
- No inline `fetch()` in components or pages

## Commit Style

```
feat: add voice activity detection threshold config
fix: prevent double audio playback on fast WS messages
refactor: extract evaluation logic into useInterview hook
docs: update architecture diagram
```

## Pull Requests

- Keep PRs focused — one concern per PR
- Update `docs/ARCHITECTURE.md` if you add a new folder or change the data flow
- If adding a new backend endpoint dependency, document it in `README.md`
