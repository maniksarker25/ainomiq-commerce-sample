/**
 * Client helpers for Content Studio `/api/content/*` responses.
 */

import { toast } from "sonner";

export type ContentApiErrorBody = {
  success?: false;
  error?: string;
  code?: string;
  credits?: unknown;
};

export class ContentApiError extends Error {
  code?: string;
  credits?: unknown;
  status: number;

  constructor(
    message: string,
    options?: { code?: string; status?: number; credits?: unknown },
  ) {
    super(message);
    this.name = "ContentApiError";
    this.code = options?.code;
    this.status = options?.status ?? 500;
    this.credits = options?.credits;
  }
}

export async function readContentApiJson<T extends Record<string, unknown>>(
  res: Response,
): Promise<T & { success?: boolean }> {
  const body = (await res.json().catch(() => ({}))) as T & ContentApiErrorBody;
  if (!res.ok || body.success === false) {
    throw new ContentApiError(body.error || "Request failed", {
      code: body.code,
      status: res.status,
      credits: body.credits,
    });
  }
  return body;
}

export async function contentApiFetch<T extends Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T & { success?: boolean }> {
  const res = await fetch(input, init);
  return readContentApiJson<T>(res);
}

export type ContentAgentStreamComplete = {
  reply?: string;
  needs_clarification?: boolean;
  questions?: string[];
  drafts?: Array<{
    title?: string;
    type?: string;
    content?: string;
    image_url?: string | null;
    image_error?: string | null;
    visual_prompt?: string | null;
  }>;
  ideas?: unknown[];
  error?: string;
  code?: string;
  credits?: unknown;
};

export async function streamContentAgentChat(
  body: Record<string, unknown>,
  handlers: {
    onDelta?: (reply: string) => void;
    onPhase?: (phase: string, meta?: Record<string, unknown>) => void;
  },
): Promise<ContentAgentStreamComplete> {
  const res = await fetch("/api/content/agent-chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as ContentApiErrorBody;
    throw new ContentApiError(errBody.error || "Agent chat failed", {
      code: errBody.code,
      status: res.status,
      credits: errBody.credits,
    });
  }

  const reader = res.body?.getReader();
  if (!reader) throw new ContentApiError("No response stream", { status: 500 });

  const decoder = new TextDecoder();
  let buffer = "";
  let complete: ContentAgentStreamComplete = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let event = "message";
      let dataLine = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataLine = line.slice(5).trim();
      }
      if (!dataLine) continue;
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(dataLine);
      } catch {
        continue;
      }

      if (event === "delta" && typeof payload.reply === "string") {
        handlers.onDelta?.(payload.reply);
      } else if (event === "phase" && typeof payload.phase === "string") {
        handlers.onPhase?.(payload.phase, payload);
      } else if (event === "complete") {
        complete = payload as ContentAgentStreamComplete;
      } else if (event === "error") {
        throw new ContentApiError(
          String(payload.error || "Agent chat failed"),
          {
            code: typeof payload.code === "string" ? payload.code : undefined,
            status: 402,
            credits: payload.credits,
          },
        );
      }
    }
  }

  if (!complete.reply && !complete.needs_clarification) {
    throw new ContentApiError("Stream ended without a response", {
      status: 500,
    });
  }

  return complete;
}

export function toastContentApiError(err: unknown, fallback: string) {
  if (err instanceof ContentApiError) {
    if (err.code === "INSUFFICIENT_CREDITS") {
      toast.error(err.message, {
        description: "Add Nomi credits to continue.",
      });
      return;
    }
    toast.error(err.message || fallback);
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}
