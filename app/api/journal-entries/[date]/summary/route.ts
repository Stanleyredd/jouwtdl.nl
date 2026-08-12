import { getCurrentUser } from "@/lib/auth";
import {
  normalizeJournalSummaryPayload,
  updateJournalSummaryForUser,
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

export async function PATCH(
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
    payload = normalizeJournalSummaryPayload(
      await request.json().catch(() => null),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Use a valid journal summary payload.",
      },
      { status: 400 },
    );
  }

  try {
    const journalEntry = await updateJournalSummaryForUser(
      context.user.id,
      date,
      payload,
    );

    return Response.json({ journalEntry });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Journal summary could not be saved right now.",
      },
      { status: 500 },
    );
  }
}
