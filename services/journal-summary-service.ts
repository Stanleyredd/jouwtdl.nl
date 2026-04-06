"use client";

import type { JournalConfig, JournalSections, TomorrowSetup } from "@/types";
import { type AppLanguage } from "@/lib/i18n";

interface GenerateJournalSummaryInput {
  date: string;
  sections: JournalSections;
  tomorrowSetup: TomorrowSetup;
  language: AppLanguage;
  journalConfig: JournalConfig;
}

export async function generateJournalSummary({
  date,
  sections,
  tomorrowSetup,
  language,
  journalConfig,
}: GenerateJournalSummaryInput) {
  if (process.env.NODE_ENV === "development") {
    console.debug("[journal-summary]", "summary-api-called", {
      date,
      language,
    });
  }

  const response = await fetch("/api/journal-summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      date,
      sections,
      tomorrowSetup,
      language,
      journalConfig,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | { summary?: string; error?: string }
    | null;

  if (process.env.NODE_ENV === "development") {
    console.debug("[journal-summary]", "raw-summary-response-received", {
      ok: response.ok,
      status: response.status,
      data,
    });
  }

  if (!response.ok || !data?.summary) {
    if (process.env.NODE_ENV === "development") {
      console.error("[journal-summary]", "frontend-summary-failure", {
        ok: response.ok,
        status: response.status,
        data,
      });
    }

    throw new Error(
      data?.error ?? "Summary could not be generated right now. Your journal is still saved.",
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[journal-summary]", "parsed-summary", {
      summary: data.summary,
    });
  }

  const summary = data.summary.trim();

  if (!summary) {
    if (process.env.NODE_ENV === "development") {
      console.error("[journal-summary]", "frontend-summary-failure", {
        ok: response.ok,
        status: response.status,
        data,
        reason: "summary was empty after trim",
      });
    }

    throw new Error("No summary was returned. Your journal is still saved.");
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[journal-summary]", "frontend-summary-success", {
      summary,
    });
  }

  return summary;
}
