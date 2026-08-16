"use client";

import type { DreamEntry, DreamSource } from "@/types";

export interface DreamEntryApiCreateInput {
  title?: string;
  content: string;
  dreamDate: string;
  source?: DreamSource;
}

export interface DreamEntryApiUpdateInput {
  title?: string;
  content?: string;
  dreamDate?: string;
  source?: DreamSource;
}

async function parseDreamResponse<T>(
  response: Response,
): Promise<{ data: T | null; error: string | null }> {
  const data = (await response.json().catch(() => null)) as
    | {
        error?: string;
        dream?: T;
        dreams?: T;
      }
    | null;

  if (!response.ok) {
    return {
      data: null,
      error: data?.error ?? "Dreams could not be loaded right now.",
    };
  }

  return {
    data: (data?.dream ?? data?.dreams ?? null) as T | null,
    error: null,
  };
}

export async function listDreamEntries() {
  const response = await fetch("/api/dreams", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const result = await parseDreamResponse<DreamEntry[]>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Dreams could not be loaded right now.");
  }

  return result.data;
}

export async function getDreamEntryById(id: string) {
  const response = await fetch(`/api/dreams/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const result = await parseDreamResponse<DreamEntry>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Dream could not be loaded right now.");
  }

  return result.data;
}

export async function createDreamEntry(input: DreamEntryApiCreateInput) {
  const response = await fetch("/api/dreams", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await parseDreamResponse<DreamEntry>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Dream could not be saved right now.");
  }

  return result.data;
}

export async function updateDreamEntryById(
  id: string,
  input: DreamEntryApiUpdateInput,
) {
  const response = await fetch(`/api/dreams/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await parseDreamResponse<DreamEntry>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Dream could not be updated right now.");
  }

  return result.data;
}

export async function deleteDreamEntryById(id: string) {
  const response = await fetch(`/api/dreams/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (response.ok) {
    return;
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  throw new Error(data?.error ?? "Dream could not be deleted right now.");
}
