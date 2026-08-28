"use client";

import type { AppLanguage } from "@/lib/i18n";
import type { JournalEntry, JournalEntryInput, TomorrowSetup } from "@/types";

export interface JournalEntryApiSaveInput extends JournalEntryInput {
  language: AppLanguage;
  lifeAreas: string[];
  createdAt?: string;
  aiSummary?: string;
  aiSummaryError?: string | null;
  aiSummaryUpdatedAt?: string;
  finalizedAt?: string;
}

export interface JournalEntrySummaryApiInput {
  lifeAreas: string[];
  aiSummary?: string;
  aiSummaryError?: string | null;
}

export interface JournalSectionApiSaveInput {
  content: string;
  rawTranscript: string;
  editedTranscript: string;
  language: AppLanguage;
  lifeAreas: string[];
}

export interface JournalTomorrowSetupApiSaveInput {
  tomorrowSetup: TomorrowSetup;
  rawTranscript: string;
  editedTranscript: string;
  language: AppLanguage;
  lifeAreas: string[];
}

export interface FinalizeJournalEntryApiInput {
  lifeAreas: string[];
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

export async function saveJournalSectionByDate(
  date: string,
  sectionKey: string,
  input: JournalSectionApiSaveInput,
) {
  const response = await fetch(
    `/api/journal-entries/${encodeURIComponent(date)}/sections/${encodeURIComponent(sectionKey)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const result = await parseJournalEntryResponse<JournalEntry>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Journal section could not be saved right now.");
  }

  return result.data;
}

export async function saveTomorrowSetupByDate(
  date: string,
  input: JournalTomorrowSetupApiSaveInput,
) {
  const response = await fetch(
    `/api/journal-entries/${encodeURIComponent(date)}/tomorrow-setup`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const result = await parseJournalEntryResponse<JournalEntry>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Tomorrow setup could not be saved right now.");
  }

  return result.data;
}

export async function finalizeJournalEntryByDate(
  date: string,
  input: FinalizeJournalEntryApiInput,
) {
  const response = await fetch(
    `/api/journal-entries/${encodeURIComponent(date)}/finalize`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const result = await parseJournalEntryResponse<JournalEntry>(response);

  if (!result.data) {
    throw new Error(
      result.error ?? "Journal summary could not be generated right now.",
    );
  }

  return result.data;
}
