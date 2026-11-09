import "server-only";

import { getCurrentUser } from "@/lib/auth";
import {
  IDEA_CONTENT_LIMIT, IDEA_TITLE_LIMIT, ideaCategories, ideaPriorities, ideaStatuses,
  type IdeaFields,
} from "@/lib/ideas";

export function ideaNotFound() {
  return Response.json({ error: "Idea not found." }, { status: 404 });
}

export function isIdeaId(id: string) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
}

export async function withIdeaUser(action: (userId: string) => Promise<Response>) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Sign in to use Ideas." }, { status: 401 });
    }
    const response = await action(user.id);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return Response.json({ error: "The idea request could not be completed." }, { status: 500 });
  }
}

export function invalidIdeaPayload() {
  return Response.json({ error: "Invalid idea fields." }, { status: 400 });
}

function normalizeText(value: unknown, limit: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= limit && !text.includes("\0") ? text : null;
}

function isOption<T extends string>(value: unknown, options: readonly T[]): value is T {
  return options.some((option) => option === value);
}

export async function readIdeaFields(request: Request, creating: boolean) {
  const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") return null;

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const candidate = body as Record<string, unknown>;
  const fields: Partial<IdeaFields> = {};

  if (creating || "title" in candidate) {
    const title = normalizeText(candidate.title, IDEA_TITLE_LIMIT);
    if (!title) return null;
    fields.title = title;
  }
  if (creating || "content" in candidate) {
    const content = normalizeText(candidate.content, IDEA_CONTENT_LIMIT);
    if (!content) return null;
    fields.content = content;
  }
  if ("category" in candidate) {
    if (!isOption(candidate.category, ideaCategories)) return null;
    fields.category = candidate.category;
  }
  if ("priority" in candidate) {
    if (!isOption(candidate.priority, ideaPriorities)) return null;
    fields.priority = candidate.priority;
  }
  if (!creating && "status" in candidate) {
    if (!isOption(candidate.status, ideaStatuses)) return null;
    fields.status = candidate.status;
  }

  return Object.keys(fields).length > 0 ? fields : null;
}
