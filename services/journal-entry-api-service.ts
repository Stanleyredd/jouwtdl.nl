"use client";

import type { AppLanguage } from "@/lib/i18n";
import type { JournalEntry, JournalEntryInput } from "@/types";

export interface JournalEntryApiSaveInput extends JournalEntryInput {
  language: AppLanguage;
  lifeAreas: string[];
  createdAt?: string;
  aiSummary?: string;
  aiSummaryError?: string | null;
  aiSummaryUpdatedAt?: string;
}

export interface JournalEntrySummaryApiInput {
  lifeAreas: string[];
  aiSummary?: string;
  aiSummaryError?: string | null;
}

async function parseJournalEntryResponse<T>(
  response: Response,
): Promise<{ data: T | null; error: string | null }> {
  const data = (await response.json().catch(() => null)) as
    | {
        error?: string;
        journalEntry?: T;
        journalEntries?: T;
      }
    | null;

  if (!response.ok) {
    return {
      data: null,
      error: data?.error ?? "Journal data could not be loaded right now.",
    };
  }

  return {
    data: (data?.journalEntry ?? data?.journalEntries ?? null) as T | null,
    error: null,
  };
}

export async function listJournalEntries(lifeAreas: string[]) {
  const params = new URLSearchParams();
  lifeAreas.forEach((lifeArea) => params.append("lifeArea", lifeArea));

  const response = await fetch(
    `/api/journal-entries${params.toString() ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    },
  );

  const result = await parseJournalEntryResponse<JournalEntry[]>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Journal entries could not be loaded right now.");
  }

  return result.data;
}

export async function saveJournalEntry(input: JournalEntryApiSaveInput) {
  const response = await fetch("/api/journal-entries", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await parseJournalEntryResponse<JournalEntry>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Journal could not be saved. Try again.");
  }

  return result.data;
}

export async function updateJournalSummaryByDate(
  date: string,
  input: JournalEntrySummaryApiInput,
) {
  const response = await fetch(
    `/api/journal-entries/${encodeURIComponent(date)}/summary`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const result = await parseJournalEntryResponse<JournalEntry | null>(response);

  if (!response.ok) {
    throw new Error(
      result.error ?? "Journal summary could not be saved right now.",
    );
  }

  return result.data;
}
