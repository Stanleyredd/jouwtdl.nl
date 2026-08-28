import {
  buildStructuredJournalText,
  normalizeJournalSections,
} from "@/data/journal-template";
import {
  getCurrentUser,
} from "@/lib/auth";
import {
  normalizeJournalConfig,
} from "@/lib/journal-config";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { generateJournalSummaryFromStoredContent } from "@/services/journal-summary-generator";
import type { JournalConfig, JournalSections, TomorrowSetup } from "@/types";

export const runtime = "nodejs";

function normalizeTomorrowSetup(value: TomorrowSetup | undefined): TomorrowSetup {
  return {
    mainFocus: value?.mainFocus ?? "",
    topTasks: Array.isArray(value?.topTasks) ? value.topTasks : [],
    watchOutFor: value?.watchOutFor ?? "",
    intention: value?.intention ?? "",
  };
}

function toSafeSummaryErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Summary could not be generated right now. Your journal is still saved.";

  if (message.includes("OPENAI_API_KEY")) {
    return "Journal summary is not configured right now. Your journal is still saved.";
  }

  return message;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json(
        {
          error: "You need to log in before generating a journal summary.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      date?: string;
      sections?: JournalSections;
      tomorrowSetup?: TomorrowSetup;
      language?: AppLanguage;
      journalConfig?: JournalConfig;
    };

    const date = typeof body.date === "string" ? body.date : "";
    const language = normalizeLanguage(body.language);
    const journalConfig = normalizeJournalConfig(body.journalConfig, language);
    const sections = normalizeJournalSections(body.sections, journalConfig);
    const tomorrowSetup = normalizeTomorrowSetup(body.tomorrowSetup);
    const journalText = buildStructuredJournalText(sections, journalConfig);

    if (!date) {
      return Response.json({ error: "A journal date is required." }, { status: 400 });
    }

    if (!journalText.trim()) {
      return Response.json(
        { error: "Write a little more before generating a summary." },
        { status: 400 },
      );
    }

    const summary = await generateJournalSummaryFromStoredContent({
      date,
      journalText,
      sections,
      tomorrowSetup,
      language,
      journalConfig,
    });

    return Response.json({ summary });
  } catch (error) {
    return Response.json(
      {
        error: toSafeSummaryErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
