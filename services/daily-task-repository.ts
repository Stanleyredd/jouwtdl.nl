import "server-only";

import { Prisma, type DailyTask as PrismaDailyTask } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";
import { createId } from "@/lib/utils";
import type { DailyTask, TaskPriority } from "@/types";

const taskPriorities = new Set<TaskPriority>(["low", "medium", "high"]);

export interface CreateDailyTaskInput {
  id?: string;
  weeklyGoalId?: string | null;
  title: string;
  note: string;
  date: string;
  priority: TaskPriority;
  lifeArea: string;
  completed: boolean;
  carryOverCount: number;
  createdAt?: string;
}

export interface UpdateDailyTaskInput {
  weeklyGoalId?: string | null;
  title?: string;
  note?: string;
  date?: string;
  priority?: TaskPriority;
  lifeArea?: string;
  completed?: boolean;
  carryOverCount?: number;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateOnly(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Use a valid date.");
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function parseTimestamp(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Use a valid timestamp.");
  }

  return parsed;
}

function normalizeCarryOverCount(value: number) {
  return Math.max(Math.round(value), 0);
}

function mapPrismaDailyTask(task: PrismaDailyTask): DailyTask {
  return {
    id: task.id,
    weeklyGoalId: task.weeklyGoalId,
    title: task.title,
    note: task.note,
    date: formatDateOnly(task.date),
    priority: task.priority as TaskPriority,
    lifeArea: task.lifeArea,
    completed: task.completed,
    carryOverCount: task.carryOverCount,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function assertOwnedDailyTask(task: PrismaDailyTask | null, userId: string) {
  if (!task) {
    throw new Error("Daily task not found.");
  }

  if (task.userId !== userId) {
    throw new Error("Daily task not found.");
  }

  return task;
}

async function assertOwnedWeeklyGoal(
  userId: string,
  weeklyGoalId: string | null | undefined,
) {
  if (!weeklyGoalId) {
    return null;
  }

  const prisma = getPrismaClient();
  const weeklyGoal = await prisma.weeklyGoal.findUnique({
    where: { id: weeklyGoalId },
  });

  if (!weeklyGoal || weeklyGoal.userId !== userId) {
    throw new Error("Weekly goal not found.");
  }

  return weeklyGoal;
}

export async function listDailyTasksForUser(userId: string) {
  const prisma = getPrismaClient();
  const tasks = await prisma.dailyTask.findMany({
    where: { userId },
    orderBy: [
      { date: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  return tasks.map(mapPrismaDailyTask);
}

export async function createDailyTaskForUser(
  userId: string,
  input: CreateDailyTaskInput,
) {
  const prisma = getPrismaClient();
  const requestedId = input.id?.trim() || createId("task");
  const createdAt = parseTimestamp(input.createdAt);

  const existingTask = await prisma.dailyTask.findUnique({
    where: { id: requestedId },
  });

  if (existingTask) {
    if (existingTask.userId !== userId) {
      throw new Error("Daily task id already exists.");
    }

    return mapPrismaDailyTask(existingTask);
  }

  await assertOwnedWeeklyGoal(userId, input.weeklyGoalId);

  const createdTask = await prisma.dailyTask.create({
    data: {
      id: requestedId,
      userId,
      weeklyGoalId: input.weeklyGoalId ?? null,
      title: input.title,
      note: input.note,
      date: parseDateOnly(input.date),
      priority: input.priority,
      lifeArea: input.lifeArea,
      completed: input.completed,
      carryOverCount: normalizeCarryOverCount(input.carryOverCount),
      ...(createdAt
        ? {
            createdAt,
          }
        : {}),
    },
  });

  return mapPrismaDailyTask(createdTask);
}

export async function updateDailyTaskForUser(
  userId: string,
  taskId: string,
  input: UpdateDailyTaskInput,
) {
  const prisma = getPrismaClient();
  const existingTask = await prisma.dailyTask.findUnique({
    where: { id: taskId },
  });

  assertOwnedDailyTask(existingTask, userId);

  if (input.weeklyGoalId !== undefined) {
    await assertOwnedWeeklyGoal(userId, input.weeklyGoalId);
  }

  const updateData: Prisma.DailyTaskUncheckedUpdateInput = {};

  if (input.weeklyGoalId !== undefined) {
    updateData.weeklyGoalId = input.weeklyGoalId;
  }

  if (input.title !== undefined) {
    updateData.title = input.title;
  }

  if (input.note !== undefined) {
    updateData.note = input.note;
  }

  if (input.date !== undefined) {
    updateData.date = parseDateOnly(input.date);
  }

  if (input.priority !== undefined) {
    updateData.priority = input.priority;
  }

  if (input.lifeArea !== undefined) {
    updateData.lifeArea = input.lifeArea;
  }

  if (input.completed !== undefined) {
    updateData.completed = input.completed;
  }

  if (input.carryOverCount !== undefined) {
    updateData.carryOverCount = normalizeCarryOverCount(input.carryOverCount);
  }

  const updatedTask = await prisma.dailyTask.update({
    where: { id: taskId },
    data: updateData,
  });

  return mapPrismaDailyTask(updatedTask);
}

export async function deleteDailyTaskForUser(userId: string, taskId: string) {
  const prisma = getPrismaClient();
  const existingTask = await prisma.dailyTask.findUnique({
    where: { id: taskId },
  });

  assertOwnedDailyTask(existingTask, userId);

  await prisma.dailyTask.delete({
    where: { id: taskId },
  });
}

export function normalizeDailyTaskCreatePayload(
  body: unknown,
): CreateDailyTaskInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid daily task payload.");
  }

  const candidate = body as Record<string, unknown>;
  const weeklyGoalId =
    candidate.weeklyGoalId === null
      ? null
      : typeof candidate.weeklyGoalId === "string"
        ? candidate.weeklyGoalId
        : undefined;
  const title = typeof candidate.title === "string" ? candidate.title : "";
  const note = typeof candidate.note === "string" ? candidate.note : "";
  const date = typeof candidate.date === "string" ? candidate.date : "";
  const lifeArea = typeof candidate.lifeArea === "string" ? candidate.lifeArea : "";
  const createdAt =
    typeof candidate.createdAt === "string" ? candidate.createdAt : undefined;
  const carryOverCount =
    typeof candidate.carryOverCount === "number" ? candidate.carryOverCount : 0;
  const completed =
    typeof candidate.completed === "boolean" ? candidate.completed : false;

  if (!taskPriorities.has(candidate.priority as TaskPriority)) {
    throw new Error("Use a valid task priority.");
  }

  if (!date.trim()) {
    throw new Error("Use a valid task date.");
  }

  return {
    id: typeof candidate.id === "string" ? candidate.id : undefined,
    weeklyGoalId,
    title,
    note,
    date,
    priority: candidate.priority as TaskPriority,
    lifeArea,
    completed,
    carryOverCount,
    createdAt,
  };
}

export function normalizeDailyTaskUpdatePayload(
  body: unknown,
): UpdateDailyTaskInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid daily task payload.");
  }

  const candidate = body as Record<string, unknown>;
  const update: UpdateDailyTaskInput = {};

  if (candidate.weeklyGoalId !== undefined) {
    if (
      candidate.weeklyGoalId !== null &&
      typeof candidate.weeklyGoalId !== "string"
    ) {
      throw new Error("Use a valid weekly goal.");
    }

    update.weeklyGoalId = candidate.weeklyGoalId;
  }

  if (candidate.title !== undefined) {
    if (typeof candidate.title !== "string") {
      throw new Error("Use a valid title.");
    }
    update.title = candidate.title;
  }

  if (candidate.note !== undefined) {
    if (typeof candidate.note !== "string") {
      throw new Error("Use a valid note.");
    }
    update.note = candidate.note;
  }

  if (candidate.date !== undefined) {
    if (typeof candidate.date !== "string") {
      throw new Error("Use a valid date.");
    }
    update.date = candidate.date;
  }

  if (candidate.priority !== undefined) {
    if (!taskPriorities.has(candidate.priority as TaskPriority)) {
      throw new Error("Use a valid task priority.");
    }
    update.priority = candidate.priority as TaskPriority;
  }

  if (candidate.lifeArea !== undefined) {
    if (typeof candidate.lifeArea !== "string") {
      throw new Error("Use a valid life area.");
    }
    update.lifeArea = candidate.lifeArea;
  }

  if (candidate.completed !== undefined) {
    if (typeof candidate.completed !== "boolean") {
      throw new Error("Use a valid completion state.");
    }
    update.completed = candidate.completed;
  }

  if (candidate.carryOverCount !== undefined) {
    if (typeof candidate.carryOverCount !== "number") {
      throw new Error("Use a valid carry-over count.");
    }
    update.carryOverCount = candidate.carryOverCount;
  }

  return update;
}
