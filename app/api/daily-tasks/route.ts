import { getCurrentUser } from "@/lib/auth";
import {
  createDailyTaskForUser,
  listDailyTasksForUser,
  normalizeDailyTaskCreatePayload,
} from "@/services/daily-task-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getAuthedUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: Response.json(
        { error: "You need to log in before using daily tasks." },
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
    const dailyTasks = await listDailyTasksForUser(context.user.id);
    return Response.json({ dailyTasks });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Daily tasks could not be loaded right now.",
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
    payload = normalizeDailyTaskCreatePayload(
      await request.json().catch(() => null),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Use a valid daily task payload.",
      },
      { status: 400 },
    );
  }

  try {
    const dailyTask = await createDailyTaskForUser(context.user.id, payload);
    return Response.json({ dailyTask }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Daily task could not be created right now.";
    const status =
      message === "Daily task id already exists."
        ? 409
        : message === "Weekly goal not found."
          ? 404
          : message.startsWith("Use a valid")
            ? 400
            : 500;

    return Response.json({ error: message }, { status });
  }
}
