import { getCurrentUser } from "@/lib/auth";
import {
  createMonthlyGoalForUser,
  listMonthlyGoalsForUser,
  normalizeMonthlyGoalCreatePayload,
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

export async function GET() {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  try {
    const monthlyGoals = await listMonthlyGoalsForUser(context.user.id);
    return Response.json({ monthlyGoals });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Monthly goals could not be loaded right now.",
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
    payload = normalizeMonthlyGoalCreatePayload(
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
    const monthlyGoal = await createMonthlyGoalForUser(context.user.id, payload);
    return Response.json({ monthlyGoal }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Monthly goal could not be created right now.";
    const status =
      message === "Monthly goal id already exists."
        ? 409
        : message === "Use a valid due date." || message === "Use a valid timestamp."
          ? 400
          : 500;

    return Response.json({ error: message }, { status });
  }
}
