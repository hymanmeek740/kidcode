"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ActivityEvent {
  content: string;
  detail?: string;
}

interface UseChatOptions {
  projectId: string;
  onTitle?: (title: string) => void;
  onFileChange?: (fileName: string) => void;
}

export function useChat({ projectId, onTitle, onFileChange }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activity, setActivity] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setActivity("");

      let assistantText = "";

      // Add placeholder assistant message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", timestamp: new Date().toISOString() },
      ]);

      try {
        abortRef.current = new AbortController();
        const res = await fetch(`/api/projects/${projectId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let gotTitle = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6));

                switch (event.type) {
                  case "text": {
                    let text = event.content as string;
                    // Strip TITLE line from displayed text
                    if (!gotTitle) {
                      const titleMatch = text.match(/^TITLE:\s*.+\n*/m);
                      if (titleMatch) {
                        text = text.replace(/^TITLE:\s*.+\n*/m, "");
                        gotTitle = true;
                      }
                    }
                    assistantText += text;
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        content: assistantText,
                      };
                      return updated;
                    });
                    break;
                  }
                  case "title":
                    gotTitle = true;
                    onTitle?.(event.content);
                    if (event.detail) {
                      // detail contains text without the title line
                      let text = event.detail as string;
                      text = text.replace(/^TITLE:\s*.+\n*/m, "");
                      if (text) {
                        assistantText += text;
                        setMessages((prev) => {
                          const updated = [...prev];
                          updated[updated.length - 1] = {
                            ...updated[updated.length - 1],
                            content: assistantText,
                          };
                          return updated;
                        });
                      }
                    }
                    break;
                  case "activity":
                    setActivity(event.content);
                    break;
                  case "file-change":
                    onFileChange?.(event.content);
                    setActivity(`Updated ${event.content}`);
                    break;
                  case "error":
                    assistantText += `\n\nError: ${event.content}`;
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        content: assistantText,
                      };
                      return updated;
                    });
                    break;
                  case "done":
                    break;
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          assistantText += `\n\nSorry, something went wrong. Please try again!`;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: assistantText,
            };
            return updated;
          });
        }
      } finally {
        setIsLoading(false);
        setActivity("");
        abortRef.current = null;
      }
    },
    [projectId, isLoading, onTitle, onFileChange]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, setMessages, isLoading, activity, sendMessage, stop, loadHistory };
}
