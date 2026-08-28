import { getCurrentUser } from "@/lib/auth";
import {
  normalizeJournalSectionPayload,
  saveJournalSectionForUser,
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
  {
    params,
  }: {
    params: Promise<{ date: string; sectionKey: string }>;
  },
) {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  const { date, sectionKey } = await params;

  let payload;

  try {
    payload = normalizeJournalSectionPayload(
      await request.json().catch(() => null),
      sectionKey,
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Use a valid journal section payload.",
      },
      { status: 400 },
    );
  }

  try {
    const { journalEntry } = await saveJournalSectionForUser(
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
            : "This journal section could not be saved right now.",
      },
      { status: 500 },
    );
  }
}
