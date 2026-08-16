import { getCurrentUser } from "@/lib/auth";
import {
  createDreamEntryForUser,
  listDreamEntriesForUser,
  normalizeDreamEntryCreatePayload,
} from "@/services/dream-entry-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getAuthedUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: Response.json(
        { error: "You need to log in before using dreams." },
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

export async function GET() {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  try {
    const dreams = await listDreamEntriesForUser(context.user.id);
    return Response.json({ dreams });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Dreams could not be loaded right now.",
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
    payload = normalizeDreamEntryCreatePayload(
      await request.json().catch(() => null),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Use a valid dream payload.",
      },
      { status: 400 },
    );
  }

  try {
    const dream = await createDreamEntryForUser(context.user.id, payload);
    return Response.json({ dream }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dream could not be saved right now.";
    const status =
      message.startsWith("Use a valid") ||
      message === "Dream date is required." ||
      message === "Dream content cannot be empty."
        ? 400
        : 500;

    return Response.json({ error: message }, { status });
  }
}
