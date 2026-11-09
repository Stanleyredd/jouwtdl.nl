"use client";

import type { IdeaEntry, IdeaFields } from "@/lib/ideas";

async function requestIdeas(path = "", init?: RequestInit) {
  const response = await fetch(`/api/ideas${path}`, {
    ...init,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The idea request could not be completed.");
  return response;
}

export async function listIdeas(signal?: AbortSignal) {
  const response = await requestIdeas("", { signal });
  const { ideas } = (await response.json()) as { ideas: IdeaEntry[] };
  return ideas;
}

export async function saveIdea(fields: IdeaFields, id?: string) {
  const { title, content, category, priority, status } = fields;
  const response = await requestIdeas(id ? `/${encodeURIComponent(id)}` : "", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, category, priority, ...(id ? { status } : {}) }),
  });
  const { idea } = (await response.json()) as { idea: IdeaEntry };
  return idea;
}

export async function deleteIdea(id: string) {
  await requestIdeas(`/${encodeURIComponent(id)}`, { method: "DELETE" });
}
