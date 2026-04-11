import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AppState,
  DailyFocus,
  DailyTask,
  MonthlyGoal,
  WeeklyGoal,
} from "@/types";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;
type PlanningSlice = Pick<AppState, "monthlyGoals" | "weeklyGoals" | "dailyTasks" | "dailyFocuses">;
type MonthlyGoalRow = Database["public"]["Tables"]["monthly_goals"]["Row"];
type WeeklyGoalRow = Database["public"]["Tables"]["weekly_goals"]["Row"];
type DailyTaskRow = Database["public"]["Tables"]["daily_tasks"]["Row"];
type DailyFocusRow = Database["public"]["Tables"]["daily_focuses"]["Row"];

function serializePlanningError(error: unknown) {
  if (!(error instanceof Error) && (typeof error !== "object" || error === null)) {
    return {
      message: String(error),
    };
  }

  const candidate = error as Error & {
    code?: string;
    details?: string;
    hint?: string;
    name?: string;
    status?: number;
  };

  return {
    name: candidate.name,
    message: candidate.message,
    code: candidate.code,
    details: candidate.details,
    hint: candidate.hint,
    status: candidate.status,
    keys: Object.keys(candidate),
  };
}

function logPlanningDebug(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug("[planning-persistence]", event, payload);
  console.debug(
    "[planning-persistence]",
    `${event}:details`,
    JSON.stringify(payload, null, 2),
  );
}

function logPlanningPersistenceError(
  action: "load" | "save",
  table: "monthly_goals" | "weekly_goals" | "daily_tasks" | "daily_focuses",
  userId: string,
  error: unknown,
  payload?: unknown,
  query?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const errorPayload = {
    action,
    table,
    userId,
    payloadKeys:
      payload && typeof payload === "object"
        ? Object.keys(payload as Record<string, unknown>)
        : null,
    query,
    error: serializePlanningError(error),
    payload,
  };

  console.error("[planning-persistence]", "planning-request-failed", errorPayload);
  console.error(
    "[planning-persistence]",
    "planning-request-failed:details",
    JSON.stringify(errorPayload, null, 2),
  );
}

function getPlanningSchemaMismatchMessage(error: unknown) {
  const serialized = serializePlanningError(error);
  const message = serialized.message ?? "";

  const missingColumnMatch = message.match(/Could not find the '([^']+)' column of '([^']+)'/);
  if (missingColumnMatch) {
    const [, column, table] = missingColumnMatch;
    return `Your Supabase planning schema is missing ${table}.${column}. Run the latest planning migration and refresh the app.`;
  }

  const missingTableMatch = message.match(/Could not find the table '([^']+)' in the schema cache/);
  if (missingTableMatch) {
    return `Your Supabase planning schema is missing ${missingTableMatch[1]}. Run the latest planning migration and refresh the app.`;
  }

  const missingRelationMatch = message.match(/relation \"([^\"]+)\" does not exist/i);
  if (missingRelationMatch) {
    return `Your Supabase planning schema is missing ${missingRelationMatch[1]}. Run the latest planning migration and refresh the app.`;
  }

  if (
    /there is no unique or exclusion constraint matching the ON CONFLICT specification/i.test(
      message,
    )
  ) {
    return "Your Supabase planning schema is missing the required unique constraints for planning saves. Run the latest planning migration and refresh the app.";
  }

  if (/permission denied/i.test(message)) {
    return "Your Supabase planning tables are missing the required grants or RLS permissions. Run the latest planning migration and refresh the app.";
  }

  return null;
}

function throwPlanningPersistenceError(
  action: "load" | "save",
  table: "monthly_goals" | "weekly_goals" | "daily_tasks" | "daily_focuses",
  userId: string,
  error: unknown,
  fallbackMessage: string,
  payload?: unknown,
  query?: Record<string, unknown>,
): never {
  logPlanningPersistenceError(action, table, userId, error, payload, query);

  const schemaMismatchMessage = getPlanningSchemaMismatchMessage(error);
  if (schemaMismatchMessage) {
    throw new Error(schemaMismatchMessage);
  }

  throw new Error(fallbackMessage);
}

function mapMonthlyGoalRow(row: MonthlyGoalRow): MonthlyGoal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    month: row.month,
    year: row.year,
    lifeArea: row.life_area,
    status: row.status as MonthlyGoal["status"],
    progress: row.progress,
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeeklyGoalRow(row: WeeklyGoalRow): WeeklyGoal {
  return {
    id: row.id,
    monthlyGoalId: row.monthly_goal_id,
    title: row.title,
    description: row.description,
    weekNumber: row.week_number,
    startDate: row.start_date,
    endDate: row.end_date,
    lifeArea: row.life_area,
    status: row.status as WeeklyGoal["status"],
    progress: row.progress,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDailyTaskRow(row: DailyTaskRow): DailyTask {
  return {
    id: row.id,
    weeklyGoalId: row.weekly_goal_id,
    title: row.title,
    note: row.note,
    date: row.date,
    priority: row.priority as DailyTask["priority"],
    lifeArea: row.life_area,
    completed: row.completed,
    carryOverCount: row.carry_over_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDailyFocusRow(row: DailyFocusRow): DailyFocus {
  return {
    id: row.id,
    date: row.date,
    mainFocus: row.main_focus,
    secondaryFocuses: row.secondary_focuses,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildMonthlyGoalRow(
  userId: string,
  goal: MonthlyGoal,
): Database["public"]["Tables"]["monthly_goals"]["Insert"] {
  return {
    id: goal.id,
    user_id: userId,
    title: goal.title,
    description: goal.description,
    month: goal.month,
    year: goal.year,
    life_area: goal.lifeArea,
    status: goal.status,
    progress: goal.progress,
    due_date: goal.dueDate?.trim() ? goal.dueDate : null,
    created_at: goal.createdAt,
    updated_at: goal.updatedAt,
  };
}

function buildWeeklyGoalRow(
  userId: string,
  goal: WeeklyGoal,
): Database["public"]["Tables"]["weekly_goals"]["Insert"] {
  return {
    id: goal.id,
    user_id: userId,
    monthly_goal_id: goal.monthlyGoalId,
    title: goal.title,
    description: goal.description,
    week_number: goal.weekNumber,
    start_date: goal.startDate,
    end_date: goal.endDate,
    life_area: goal.lifeArea,
    status: goal.status,
    progress: goal.progress,
    created_at: goal.createdAt,
    updated_at: goal.updatedAt,
  };
}

function buildDailyTaskRow(
  userId: string,
  task: DailyTask,
): Database["public"]["Tables"]["daily_tasks"]["Insert"] {
  return {
    id: task.id,
    user_id: userId,
    weekly_goal_id: task.weeklyGoalId,
    title: task.title,
    note: task.note,
    date: task.date,
    priority: task.priority,
    life_area: task.lifeArea,
    completed: task.completed,
    carry_over_count: task.carryOverCount,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

function buildDailyFocusRow(
  userId: string,
  focus: DailyFocus,
): Database["public"]["Tables"]["daily_focuses"]["Insert"] {
  return {
    id: focus.id,
    user_id: userId,
    date: focus.date,
    main_focus: focus.mainFocus,
    secondary_focuses: focus.secondaryFocuses,
    created_at: focus.createdAt,
    updated_at: focus.updatedAt,
  };
}

export async function listPlanningStateForUser(
  client: TypedSupabaseClient,
  userId: string,
): Promise<PlanningSlice> {
  logPlanningDebug("planning-load-started", {
    userId,
    tables: ["monthly_goals", "weekly_goals", "daily_tasks", "daily_focuses"],
  });

  const { data: monthlyRows, error: monthlyError } = await client
    .from("monthly_goals")
    .select("*")
    .eq("user_id", userId)
    .order("year", { ascending: true })
    .order("month", { ascending: true })
    .order("created_at", { ascending: true });

  if (monthlyError) {
    throwPlanningPersistenceError(
      "load",
      "monthly_goals",
      userId,
      monthlyError,
      "Planning data could not be loaded right now.",
      undefined,
      {
        filters: ["user_id=eq.currentUser"],
      },
    );
  }

  const { data: weeklyRows, error: weeklyError } = await client
    .from("weekly_goals")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (weeklyError) {
    throwPlanningPersistenceError(
      "load",
      "weekly_goals",
      userId,
      weeklyError,
      "Planning data could not be loaded right now.",
      undefined,
      {
        filters: ["user_id=eq.currentUser"],
      },
    );
  }

  const { data: dailyTaskRows, error: dailyTaskError } = await client
    .from("daily_tasks")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (dailyTaskError) {
    throwPlanningPersistenceError(
      "load",
      "daily_tasks",
      userId,
      dailyTaskError,
      "Planning data could not be loaded right now.",
      undefined,
      {
        filters: ["user_id=eq.currentUser"],
      },
    );
  }

  const { data: dailyFocusRows, error: dailyFocusError } = await client
    .from("daily_focuses")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (dailyFocusError) {
    throwPlanningPersistenceError(
      "load",
      "daily_focuses",
      userId,
      dailyFocusError,
      "Planning data could not be loaded right now.",
      undefined,
      {
        filters: ["user_id=eq.currentUser"],
      },
    );
  }

  const planningState: PlanningSlice = {
    monthlyGoals: (monthlyRows ?? []).map(mapMonthlyGoalRow),
    weeklyGoals: (weeklyRows ?? []).map(mapWeeklyGoalRow),
    dailyTasks: (dailyTaskRows ?? []).map(mapDailyTaskRow),
    dailyFocuses: (dailyFocusRows ?? []).map(mapDailyFocusRow),
  };

  logPlanningDebug("planning-load-succeeded", {
    userId,
    counts: {
      monthlyGoals: planningState.monthlyGoals.length,
      weeklyGoals: planningState.weeklyGoals.length,
      dailyTasks: planningState.dailyTasks.length,
      dailyFocuses: planningState.dailyFocuses.length,
    },
  });

  return planningState;
}

export async function savePlanningStateForUser({
  client,
  userId,
  state,
}: {
  client: TypedSupabaseClient;
  userId: string;
  state: PlanningSlice;
}) {
  const monthlyRows = state.monthlyGoals.map((goal) => buildMonthlyGoalRow(userId, goal));
  const weeklyRows = state.weeklyGoals.map((goal) => buildWeeklyGoalRow(userId, goal));
  const dailyTaskRows = state.dailyTasks.map((task) => buildDailyTaskRow(userId, task));
  const dailyFocusRows = state.dailyFocuses.map((focus) => buildDailyFocusRow(userId, focus));

  logPlanningDebug("planning-save-started", {
    userId,
    counts: {
      monthlyGoals: monthlyRows.length,
      weeklyGoals: weeklyRows.length,
      dailyTasks: dailyTaskRows.length,
      dailyFocuses: dailyFocusRows.length,
    },
  });

  if (monthlyRows.length > 0) {
    const { error } = await client.from("monthly_goals").upsert(monthlyRows, {
      onConflict: "id",
    });

    if (error) {
      throwPlanningPersistenceError(
        "save",
        "monthly_goals",
        userId,
        error,
        "Planning data could not be saved right now.",
        {
          count: monthlyRows.length,
          sample: monthlyRows[0] ?? null,
        },
      );
    }
  }

  if (weeklyRows.length > 0) {
    const { error } = await client.from("weekly_goals").upsert(weeklyRows, {
      onConflict: "id",
    });

    if (error) {
      throwPlanningPersistenceError(
        "save",
        "weekly_goals",
        userId,
        error,
        "Planning data could not be saved right now.",
        {
          count: weeklyRows.length,
          sample: weeklyRows[0] ?? null,
        },
      );
    }
  }

  if (dailyTaskRows.length > 0) {
    const { error } = await client.from("daily_tasks").upsert(dailyTaskRows, {
      onConflict: "id",
    });

    if (error) {
      throwPlanningPersistenceError(
        "save",
        "daily_tasks",
        userId,
        error,
        "Planning data could not be saved right now.",
        {
          count: dailyTaskRows.length,
          sample: dailyTaskRows[0] ?? null,
        },
      );
    }
  }

  if (dailyFocusRows.length > 0) {
    const { error } = await client.from("daily_focuses").upsert(dailyFocusRows, {
      onConflict: "id",
    });

    if (error) {
      throwPlanningPersistenceError(
        "save",
        "daily_focuses",
        userId,
        error,
        "Planning data could not be saved right now.",
        {
          count: dailyFocusRows.length,
          sample: dailyFocusRows[0] ?? null,
        },
      );
    }
  }

  const { data: existingTaskRows, error: existingTaskError } = await client
    .from("daily_tasks")
    .select("id")
    .eq("user_id", userId);

  if (existingTaskError) {
    throwPlanningPersistenceError(
      "save",
      "daily_tasks",
      userId,
      existingTaskError,
      "Planning data could not be saved right now.",
      undefined,
      {
        filters: ["user_id=eq.currentUser"],
      },
    );
  }

  const taskIdsToDelete = (existingTaskRows ?? [])
    .map((row) => row.id)
    .filter((id) => !dailyTaskRows.some((row) => row.id === id));

  if (taskIdsToDelete.length > 0) {
    const { error } = await client
      .from("daily_tasks")
      .delete()
      .eq("user_id", userId)
      .in("id", taskIdsToDelete);

    if (error) {
      throwPlanningPersistenceError(
        "save",
        "daily_tasks",
        userId,
        error,
        "Planning data could not be saved right now.",
        {
          idsToDelete: taskIdsToDelete,
        },
      );
    }
  }

  const { data: existingFocusRows, error: existingFocusError } = await client
    .from("daily_focuses")
    .select("id")
    .eq("user_id", userId);

  if (existingFocusError) {
    throwPlanningPersistenceError(
      "save",
      "daily_focuses",
      userId,
      existingFocusError,
      "Planning data could not be saved right now.",
      undefined,
      {
        filters: ["user_id=eq.currentUser"],
      },
    );
  }

  const focusIdsToDelete = (existingFocusRows ?? [])
    .map((row) => row.id)
    .filter((id) => !dailyFocusRows.some((row) => row.id === id));

  if (focusIdsToDelete.length > 0) {
    const { error } = await client
      .from("daily_focuses")
      .delete()
      .eq("user_id", userId)
      .in("id", focusIdsToDelete);

    if (error) {
      throwPlanningPersistenceError(
        "save",
        "daily_focuses",
        userId,
        error,
        "Planning data could not be saved right now.",
        {
          idsToDelete: focusIdsToDelete,
        },
      );
    }
  }

  const { data: existingWeeklyRows, error: existingWeeklyError } = await client
    .from("weekly_goals")
    .select("id")
    .eq("user_id", userId);

  if (existingWeeklyError) {
    throwPlanningPersistenceError(
      "save",
      "weekly_goals",
      userId,
      existingWeeklyError,
      "Planning data could not be saved right now.",
      undefined,
      {
        filters: ["user_id=eq.currentUser"],
      },
    );
  }

  const weeklyIdsToDelete = (existingWeeklyRows ?? [])
    .map((row) => row.id)
    .filter((id) => !weeklyRows.some((row) => row.id === id));

  if (weeklyIdsToDelete.length > 0) {
    const { error } = await client
      .from("weekly_goals")
      .delete()
      .eq("user_id", userId)
      .in("id", weeklyIdsToDelete);

    if (error) {
      throwPlanningPersistenceError(
        "save",
        "weekly_goals",
        userId,
        error,
        "Planning data could not be saved right now.",
        {
          idsToDelete: weeklyIdsToDelete,
        },
      );
    }
  }

  const { data: existingMonthlyRows, error: existingMonthlyError } = await client
    .from("monthly_goals")
    .select("id")
    .eq("user_id", userId);

  if (existingMonthlyError) {
    throwPlanningPersistenceError(
      "save",
      "monthly_goals",
      userId,
      existingMonthlyError,
      "Planning data could not be saved right now.",
      undefined,
      {
        filters: ["user_id=eq.currentUser"],
      },
    );
  }

  const monthlyIdsToDelete = (existingMonthlyRows ?? [])
    .map((row) => row.id)
    .filter((id) => !monthlyRows.some((row) => row.id === id));

  if (monthlyIdsToDelete.length > 0) {
    const { error } = await client
      .from("monthly_goals")
      .delete()
      .eq("user_id", userId)
      .in("id", monthlyIdsToDelete);

    if (error) {
      throwPlanningPersistenceError(
        "save",
        "monthly_goals",
        userId,
        error,
        "Planning data could not be saved right now.",
        {
          idsToDelete: monthlyIdsToDelete,
        },
      );
    }
  }

  logPlanningDebug("planning-save-succeeded", {
    userId,
    counts: {
      monthlyGoals: monthlyRows.length,
      weeklyGoals: weeklyRows.length,
      dailyTasks: dailyTaskRows.length,
      dailyFocuses: dailyFocusRows.length,
    },
  });
}
