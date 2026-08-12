import { getCurrentUser } from "@/lib/auth";
import {
  createWeeklyGoalForUser,
  listWeeklyGoalsForUser,
  normalizeWeeklyGoalCreatePayload,
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

export async function GET() {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  try {
    const weeklyGoals = await listWeeklyGoalsForUser(context.user.id);
    return Response.json({ weeklyGoals });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Weekly goals could not be loaded right now.",
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
    payload = normalizeWeeklyGoalCreatePayload(
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
    const weeklyGoal = await createWeeklyGoalForUser(context.user.id, payload);
    return Response.json({ weeklyGoal }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Weekly goal could not be created right now.";
    const status =
      message === "Weekly goal id already exists."
        ? 409
        : message === "Monthly goal not found."
          ? 404
          : message.startsWith("Use a valid") ||
              message === "End date cannot be before start date."
            ? 400
            : 500;

    return Response.json({ error: message }, { status });
  }
}
