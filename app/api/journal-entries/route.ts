import { getCurrentUser } from "@/lib/auth";
import {
  listJournalEntriesForUser,
  normalizeJournalEntryPayload,
  saveJournalEntryForUser,
} from "@/services/journal-entry-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET(request: Request) {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  try {
    const url = new URL(request.url);
    const lifeAreas = url.searchParams
      .getAll("lifeArea")
      .map((lifeArea) => lifeArea.trim())
      .filter(Boolean);
    const journalEntries = await listJournalEntriesForUser(
      context.user.id,
      lifeAreas,
    );

    return Response.json({ journalEntries });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Journal entries could not be loaded right now.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  let payload;

  try {
    payload = normalizeJournalEntryPayload(
      await request.json().catch(() => null),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Use a valid journal payload.",
      },
      { status: 400 },
    );
  }

  try {
    const { journalEntry, wasCreated } = await saveJournalEntryForUser(
      context.user.id,
      payload,
    );

    return Response.json(
      { journalEntry },
      { status: wasCreated ? 201 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Journal could not be saved. Try again.";
    const status =
      message.startsWith("Use a valid") || message === "Journal could not be loaded after saving."
        ? 400
        : 500;

    return Response.json({ error: message }, { status });
  }
}
