import {
  buildStructuredJournalText,
  normalizeJournalSections,
} from "@/data/journal-template";
import { getCurrentUser } from "@/lib/auth";
import { normalizeLanguage } from "@/lib/i18n";
import {
  ensureProfileForUser,
} from "@/services/profile-repository";
import { getProfileJournalConfig } from "@/services/profile-service";
import {
  finalizeJournalEntryForUser,
  getJournalEntryForUserByDate,
  markJournalCompletionWebhookSentForUser,
  normalizeJournalFinalizePayload,
  updateJournalSummaryForUser,
} from "@/services/journal-entry-repository";
import { generateJournalSummaryFromStoredContent } from "@/services/journal-summary-generator";
import { triggerJournalCompletedWebhook } from "@/services/n8n-journal-webhook-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

async function getAuthedUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: Response.json(
        { error: "You need to log in before using journal entries." },
        { status: 401 },
      ),
      user: null,
    };
  }

  return {
    error: null,
    user,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  const { date } = await params;

  let payload;

  try {
    payload = normalizeJournalFinalizePayload(
      await request.json().catch(() => null),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Use a valid journal finalize payload.",
      },
      { status: 400 },
    );
  }

  const journalEntry = await getJournalEntryForUserByDate(
    context.user.id,
    date,
    payload.lifeAreas,
  );

  if (!journalEntry) {
    return Response.json(
      {
        error: "Save eerst minimaal één journal-sectie voordat je de dag afrondt.",
      },
      { status: 400 },
    );
  }

  const profile = await ensureProfileForUser(context.user);
  const language = normalizeLanguage(profile.language);
  const journalConfig = getProfileJournalConfig(profile, language);
  const normalizedSections = normalizeJournalSections(
    journalEntry.sections,
    journalConfig,
  );
  const journalText = buildStructuredJournalText(
    normalizedSections,
    journalConfig,
  );

  if (!journalText.trim()) {
    return Response.json(
      {
        error: "Sla eerst minimaal één journal-sectie met inhoud op.",
      },
      { status: 400 },
    );
  }

  try {
    const summary = await generateJournalSummaryFromStoredContent({
      date,
      journalText,
      sections: normalizedSections,
      tomorrowSetup: journalEntry.tomorrowSetup,
      language,
      journalConfig,
    });

    const finalizedEntry = await finalizeJournalEntryForUser(
      context.user.id,
      date,
      {
        lifeAreas: payload.lifeAreas,
        aiSummary: summary,
      },
    );

    if (!finalizedEntry) {
      throw new Error("Journal summary could not be saved right now.");
    }

    if (finalizedEntry.shouldTriggerCompletionWebhook) {
      try {
        const webhookResult = await triggerJournalCompletedWebhook({
          journalEntryId: finalizedEntry.journalEntry.id,
          entryDate: finalizedEntry.journalEntry.date,
        });

        if (!webhookResult.skipped) {
          await markJournalCompletionWebhookSentForUser(context.user.id, date);
        }
      } catch (error) {
        console.error(
          "[n8n-journal-webhook] failed after successful journal finalization.",
          {
            journalEntryId: finalizedEntry.journalEntry.id,
            entryDate: finalizedEntry.journalEntry.date,
            message:
              error instanceof Error
                ? error.message
                : "Unknown webhook failure.",
          },
        );
      }
    }

    return Response.json({ journalEntry: finalizedEntry.journalEntry });
  } catch (error) {
    const message = toSafeSummaryErrorMessage(error);

    await updateJournalSummaryForUser(context.user.id, date, {
      lifeAreas: payload.lifeAreas,
      aiSummaryError: message,
    }).catch(() => null);

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
