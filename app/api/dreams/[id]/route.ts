import { getCurrentUser } from "@/lib/auth";
import {
  deleteDreamEntryForUser,
  getDreamEntryForUser,
  normalizeDreamEntryUpdatePayload,
  updateDreamEntryForUser,
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  const { id } = await params;

  try {
    const dream = await getDreamEntryForUser(context.user.id, id);
    return Response.json({ dream });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dream could not be loaded right now.";
    const status = message === "Dream not found." ? 404 : 500;

    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  const { id } = await params;

  let payload;

  try {
    payload = normalizeDreamEntryUpdatePayload(
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
    const dream = await updateDreamEntryForUser(context.user.id, id, payload);
    return Response.json({ dream });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Dream could not be updated right now.";
    const status =
      message === "Dream not found."
        ? 404
        : message.startsWith("Use a valid") || message === "Dream content cannot be empty."
          ? 400
          : 500;

    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  const { id } = await params;

  try {
    await deleteDreamEntryForUser(context.user.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Dream could not be deleted right now.";
    const status = message === "Dream not found." ? 404 : 500;

    return Response.json({ error: message }, { status });
  }
}
