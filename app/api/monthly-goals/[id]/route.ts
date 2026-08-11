import { getCurrentUser } from "@/lib/auth";
import {
  deleteMonthlyGoalForUser,
  normalizeMonthlyGoalUpdatePayload,
  updateMonthlyGoalForUser,
} from "@/services/monthly-goal-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getAuthedUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: Response.json(
        { error: "You need to log in before using monthly goals." },
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
    payload = normalizeMonthlyGoalUpdatePayload(
      await request.json().catch(() => null),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Use a valid monthly goal payload.",
      },
      { status: 400 },
    );
  }

  try {
    const monthlyGoal = await updateMonthlyGoalForUser(context.user.id, id, payload);
    return Response.json({ monthlyGoal });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Monthly goal could not be updated right now.";
    const status =
      message === "Monthly goal not found."
        ? 404
        : message.startsWith("Use a valid") || message.startsWith("Month must")
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
    await deleteMonthlyGoalForUser(context.user.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Monthly goal could not be deleted right now.";
    const status = message === "Monthly goal not found." ? 404 : 500;

    return Response.json({ error: message }, { status });
  }
}
