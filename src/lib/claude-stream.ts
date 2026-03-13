import { spawn, ChildProcess } from "child_process";
import path from "path";
import { SYSTEM_PROMPT } from "./constants";

export interface StreamEvent {
  type: "text" | "activity" | "file-change" | "title" | "done" | "error";
  content: string;
  detail?: string;
}

// Track active processes so we can kill them if needed
const activeProcesses = new Map<string, ChildProcess>();

export function killProcess(projectId: string): void {
  const proc = activeProcesses.get(projectId);
  if (proc) {
    proc.kill("SIGTERM");
    activeProcesses.delete(projectId);
  }
}

export async function* streamClaude(
  projectId: string,
  projectDir: string,
  prompt: string,
  isFirstMessage: boolean
): AsyncGenerator<StreamEvent> {
  // Ensure project directory exists
  const fs = await import("fs");
  fs.mkdirSync(projectDir, { recursive: true });

  const systemPrompt = isFirstMessage
    ? SYSTEM_PROMPT
    : SYSTEM_PROMPT.replace(
        /When the user sends their FIRST message[\s\S]*?Then continue with your normal response.\n\n/,
        ""
      );

  const args = [
    "-p", prompt,
    "--output-format", "stream-json",
    "--dangerously-skip-permissions",
    "--verbose",
    "--system-prompt", systemPrompt,
    "--model", "sonnet",
  ];

  const claudeProcess = spawn("claude", args, {
    cwd: projectDir,
    env: {
      ...process.env,
      CLAUDECODE: undefined, // Allow nested invocation
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  activeProcesses.set(projectId, claudeProcess);

  let buffer = "";
  let fullText = "";

  const processLine = (line: string): StreamEvent | null => {
    if (!line.trim()) return null;

    try {
      const data = JSON.parse(line);
      return processStreamMessage(data);
    } catch {
      // Not valid JSON, skip
      return null;
    }
  };

  const processStreamMessage = (data: Record<string, unknown>): StreamEvent | null => {
    // Handle different message types from claude --output-format stream-json
    const type = data.type as string;

    if (type === "assistant") {
      // Assistant message with content blocks
      const message = data.message as Record<string, unknown> | undefined;
      if (message?.content) {
        const content = message.content as Array<Record<string, unknown>>;
        for (const block of content) {
          if (block.type === "text") {
            const text = block.text as string;
            fullText += text;

            // Check for title in first message
            const titleMatch = text.match(/^TITLE:\s*(.+)$/m);
            if (titleMatch) {
              const cleanText = text.replace(/^TITLE:\s*.+\n*/m, "");
              return { type: "title", content: titleMatch[1].trim(), detail: cleanText };
            }

            return { type: "text", content: text };
          }
        }
      }
      return null;
    }

    if (type === "content_block_delta") {
      const delta = data.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta") {
        const text = delta.text as string;
        fullText += text;

        // Check for title
        const titleMatch = fullText.match(/^TITLE:\s*(.+)$/m);
        if (titleMatch && !fullText.includes("\nTITLE:")) {
          return { type: "title", content: titleMatch[1].trim(), detail: text };
        }

        return { type: "text", content: text };
      }
      if (delta?.type === "thinking_delta") {
        return { type: "activity", content: "thinking", detail: delta.thinking as string };
      }
      return null;
    }

    if (type === "content_block_start") {
      const contentBlock = data.content_block as Record<string, unknown> | undefined;
      if (contentBlock?.type === "tool_use") {
        const toolName = contentBlock.name as string;
        return { type: "activity", content: `Using ${toolName}...` };
      }
      return null;
    }

    if (type === "message_start" || type === "message_stop" || type === "content_block_stop") {
      return null;
    }

    if (type === "result") {
      return { type: "done", content: fullText };
    }

    // Handle tool results that might indicate file changes
    if (type === "tool_result" || (data.tool_name && data.output)) {
      const toolName = (data.tool_name || "") as string;
      const output = (data.output || "") as string;

      if (toolName === "Write" || toolName === "Edit") {
        const filePath = (data.file_path || "") as string;
        const fileName = filePath ? path.basename(filePath) : "file";
        return { type: "file-change", content: fileName, detail: filePath };
      }

      return { type: "activity", content: `${toolName}: done`, detail: output.slice(0, 200) };
    }

    return null;
  };

  // Process stdout
  const stdoutPromise = new Promise<void>((resolve) => {
    claudeProcess.stdout!.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        // lines are already handled below via the generator
      }
    });
    claudeProcess.stdout!.on("end", resolve);
  });

  // Actually yield events from stdout
  // We need a different approach - use an event queue
  const eventQueue: StreamEvent[] = [];
  let resolveWait: (() => void) | null = null;
  let done = false;

  claudeProcess.stdout!.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const event = processLine(line);
      if (event) {
        eventQueue.push(event);
        if (resolveWait) {
          resolveWait();
          resolveWait = null;
        }
      }
    }
  });

  claudeProcess.stderr!.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    // stderr often contains progress info, ignore most of it
    if (text.includes("Error") || text.includes("error")) {
      eventQueue.push({ type: "error", content: text });
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    }
  });

  claudeProcess.on("close", (code) => {
    done = true;
    if (code !== 0 && code !== null) {
      eventQueue.push({ type: "error", content: `Claude process exited with code ${code}` });
    }
    eventQueue.push({ type: "done", content: fullText });
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
    activeProcesses.delete(projectId);
  });

  // Yield events as they come in
  while (!done || eventQueue.length > 0) {
    if (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    } else if (!done) {
      await new Promise<void>((resolve) => {
        resolveWait = resolve;
      });
    }
  }
}
