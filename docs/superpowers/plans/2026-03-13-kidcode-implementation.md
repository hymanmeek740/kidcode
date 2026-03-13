# KidCode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js chat app that wraps Claude Code CLI for kid-friendly project building

**Architecture:** Next.js 15 App Router spawning Claude CLI processes per project, streaming responses via SSE, rendering output in iframe preview pane

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui, shadcn-chat

---

## Chunk 1: Project Scaffolding

### Task 1: Initialize Next.js project with dependencies

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- Create: `public/projects/.gitkeep`
- Create: `data/projects.json`

- [ ] **Step 1: Create Next.js app**
```bash
cd /Users/admin/misc/kidcode
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install shadcn/ui**
```bash
npx shadcn@latest init -d
```

- [ ] **Step 3: Install shadcn components**
```bash
npx shadcn@latest add button input scroll-area separator card badge
```

- [ ] **Step 4: Install additional dependencies**
```bash
npm install uuid
npm install -D @types/uuid
```

- [ ] **Step 5: Create project directories and initial data**
```bash
mkdir -p public/projects data
echo '[]' > data/projects.json
echo '*' > public/projects/.gitignore
echo '!.gitignore' >> public/projects/.gitignore
```

- [ ] **Step 6: Create CLAUDE.md**

- [ ] **Step 7: Initial commit**
```bash
git add -A
git commit -m "chore: initialize Next.js project with shadcn/ui"
git push -u origin main
```

---

## Chunk 2: Data Layer & API Routes

### Task 2: Project storage utilities

**Files:**
- Create: `src/lib/projects.ts`

Utility functions for reading/writing projects.json and chat-history.json. CRUD operations for projects.

### Task 3: API routes

**Files:**
- Create: `src/app/api/projects/route.ts` (GET list, POST create)
- Create: `src/app/api/projects/[id]/route.ts` (GET details)
- Create: `src/app/api/projects/[id]/chat/route.ts` (GET history, POST send message — SSE stream)

The POST chat route is the core: spawns `claude -p` with stream-json, parses output, forwards via SSE.

### Task 4: Commit data layer
```bash
git add -A && git commit -m "feat: add project storage and API routes"
```

---

## Chunk 3: Chat Stream Processing

### Task 5: Claude CLI stream parser

**Files:**
- Create: `src/lib/claude-stream.ts`

Parse `--output-format stream-json` output. Handle message types: assistant text content blocks, tool_use, tool_result, result. Extract text, detect file changes, track thinking/tool activity.

### Task 6: SSE response builder

**Files:**
- Create: `src/lib/sse.ts`

Helper to create SSE ReadableStream responses from parsed claude output. Event types: `message` (text), `activity` (tool use), `file-change` (file created/modified), `done`, `error`.

### Task 7: Commit stream processing
```bash
git add -A && git commit -m "feat: add Claude CLI stream parser and SSE helpers"
```

---

## Chunk 4: Frontend - Layout & Project Sidebar

### Task 8: App layout with sidebar

**Files:**
- Create: `src/app/layout.tsx` (modify existing)
- Create: `src/app/page.tsx` (modify existing)
- Create: `src/components/sidebar.tsx`
- Create: `src/components/project-list.tsx`

Three-column layout. Sidebar with project list, new project button.

### Task 9: Commit layout
```bash
git add -A && git commit -m "feat: add app layout with project sidebar"
```

---

## Chunk 5: Frontend - Chat Interface

### Task 10: Chat components

**Files:**
- Create: `src/components/chat/chat-panel.tsx` — main chat area
- Create: `src/components/chat/message-bubble.tsx` — individual message
- Create: `src/components/chat/chat-input.tsx` — input box
- Create: `src/components/chat/activity-indicator.tsx` — tool use display
- Create: `src/hooks/use-chat.ts` — custom hook for SSE chat streaming

### Task 11: Commit chat interface
```bash
git add -A && git commit -m "feat: add chat interface with streaming support"
```

---

## Chunk 6: Frontend - Preview Pane

### Task 12: Preview iframe component

**Files:**
- Create: `src/components/preview/preview-panel.tsx` — iframe + controls
- Create: `src/components/preview/file-browser.tsx` — list files in project

Auto-refresh iframe when file-change SSE events arrive. URL bar showing current file. Refresh button.

### Task 13: Commit preview pane
```bash
git add -A && git commit -m "feat: add preview iframe panel with auto-refresh"
```

---

## Chunk 7: Integration & Polish

### Task 14: Wire everything together

**Files:**
- Modify: `src/app/page.tsx` — integrate all components
- Create: `src/app/project/[id]/page.tsx` — project view page

Connect sidebar selection to chat panel, chat to API, API responses to preview.

### Task 15: Auto-title generation

On first message, include instruction for claude to suggest a title. Parse it from the response and update project name.

### Task 16: Final commit and push
```bash
git add -A && git commit -m "feat: integrate all components, add auto-titling"
git push
```
