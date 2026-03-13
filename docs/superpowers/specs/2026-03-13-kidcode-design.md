# KidCode Design Spec

## Overview

KidCode is a Next.js web app that wraps the Claude Code CLI to provide a kid-friendly chat interface for a 10-year-old. It looks like Claude Desktop — a chat interface with project management — but launches Claude Code CLI processes in subdirectories to build HTML apps, games, and tools that are viewable in a split-pane iframe.

## Architecture

- **Next.js 15 App Router** with TypeScript and Tailwind CSS v4
- **shadcn/ui** for base components + **shadcn-chat** for chat bubbles/input
- **Claude Code CLI** spawned as child process via `claude -p --output-format stream-json --dangerously-skip-permissions --system-prompt "..." --verbose`
- **SSE streaming** from API route to frontend for real-time chat updates
- **JSON file storage** for project metadata and chat history
- **Static file serving** via Next.js `public/projects/<uuid>/` for iframe preview

## UI Layout

```
┌──────────┬────────────────────────┬──────────────────────┐
│ Sidebar  │     Chat Area          │   Preview (iframe)   │
│          │                        │                      │
│ Projects │  [chat bubbles]        │  [rendered HTML]     │
│ list     │                        │                      │
│          │                        │                      │
│ [+ New]  │  [input box]           │  [refresh] [url]     │
└──────────┴────────────────────────┴──────────────────────┘
```

- Left sidebar: project list sorted by recency, "New Project" button
- Center: chat conversation with bubbles, streaming status, tool activity
- Right: toggleable iframe preview panel, auto-refreshes on file changes

## Data Model

### Project (`data/projects.json`)
```json
{
  "id": "uuid",
  "name": "Tic Tac Toe Game",
  "createdAt": "2026-03-13T...",
  "updatedAt": "2026-03-13T..."
}
```

### Chat History (`public/projects/<uuid>/chat-history.json`)
```json
{
  "messages": [
    { "role": "user", "content": "make me a tic tac toe game", "timestamp": "..." },
    { "role": "assistant", "content": "I'll create a tic tac toe game for you!", "timestamp": "..." }
  ]
}
```

## Stream Processing

Claude CLI `--output-format stream-json` emits JSON lines. Key message types:
- `{"type": "assistant", "message": {...}}` — text content to display
- `{"type": "tool_use", ...}` — tool activity (file edits, bash commands)
- `{"type": "tool_result", ...}` — tool output
- `{"type": "result", ...}` — final result

We parse these into:
- Chat bubbles for assistant text
- Collapsible activity indicators for tool use
- File change detection for iframe refresh

## System Prompt (hardcoded)

```
You are a helpful, friendly assistant helping a 10-year-old learn, explore, and build things.
You answer questions, build tools, games, and applications.

When building web apps, games, or visual projects, create them as HTML files in the current directory.
Use index.html as the main entry point. Include all CSS and JavaScript inline in the HTML file
when possible to keep things simple. You can create multiple files if needed.

Make things colorful, fun, and interactive! Add animations and sound effects when appropriate.
Keep explanations simple and encouraging. Use analogies a kid would understand.
Celebrate their ideas and help them learn by building.

If you don't know something, say so honestly and suggest ways to find out together.

CRITICAL: You must NEVER respond with or generate mature content that would be rated "R" in a movie.
No sexual content, graphic violence, drugs, alcohol, profanity, hate speech, or other
age-inappropriate material. Keep everything G-rated and kid-friendly at all times.
This rule applies to ALL outputs including code, text, images, and any generated files.
```

## API Routes

- `POST /api/chat` — Send message, returns SSE stream of claude responses
- `GET /api/projects` — List all projects
- `POST /api/projects` — Create new project
- `GET /api/projects/[id]` — Get project details + chat history
- `POST /api/projects/[id]/title` — Auto-generate title from first message

## Key Behaviors

1. First message creates project with temp name, then asks claude to suggest a title
2. Chat history persists across page reloads
3. iframe auto-refreshes when files in project dir change (detected from tool_result events)
4. Preview panel shows file browser for multi-file projects
5. No auth — local single-user app
