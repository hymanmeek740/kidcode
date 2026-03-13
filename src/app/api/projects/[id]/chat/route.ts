import { NextResponse } from "next/server";
import {
  getProject,
  getProjectDir,
  appendChatMessage,
  getChatHistory,
  touchProject,
} from "@/lib/projects";
import { streamClaude } from "@/lib/claude-stream";
import { createSSEStream } from "@/lib/sse";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = getChatHistory(id);
  return NextResponse.json(messages);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const userMessage = body.message as string;

  if (!userMessage?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  // Save user message
  appendChatMessage(id, {
    role: "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
  });

  touchProject(id);

  const projectDir = getProjectDir(id);
  const history = getChatHistory(id);
  const isFirstMessage = history.filter((m) => m.role === "user").length === 1;

  const events = streamClaude(id, projectDir, userMessage, isFirstMessage);
  const stream = createSSEStream(events);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
