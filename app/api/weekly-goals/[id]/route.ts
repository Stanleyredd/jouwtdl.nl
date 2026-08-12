import { getCurrentUser } from "@/lib/auth";
import {
  deleteWeeklyGoalForUser,
  normalizeWeeklyGoalUpdatePayload,
  updateWeeklyGoalForUser,
} from "@/services/weekly-goal-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getAuthedUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: Response.json(
        { error: "You need to log in before using weekly goals." },
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
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  const { id } = await params;

  let payload;

  try {
    payload = normalizeWeeklyGoalUpdatePayload(
      await request.json().catch(() => null),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Use a valid weekly goal payload.",
      },
      { status: 400 },
    );
  }

  try {
    const weeklyGoal = await updateWeeklyGoalForUser(context.user.id, id, payload);
    return Response.json({ weeklyGoal });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Weekly goal could not be updated right now.";
    const status =
      message === "Weekly goal not found." || message === "Monthly goal not found."
        ? 404
        : message.startsWith("Use a valid") ||
            message === "End date cannot be before start date."
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
    await deleteWeeklyGoalForUser(context.user.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Weekly goal could not be deleted right now.";
    const status = message === "Weekly goal not found." ? 404 : 500;

    return Response.json({ error: message }, { status });
  }
}
