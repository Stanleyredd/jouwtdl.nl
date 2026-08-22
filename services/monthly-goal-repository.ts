import "server-only";

import { Prisma, type MonthlyGoal as PrismaMonthlyGoal } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";
import { createId } from "@/lib/utils";
import type { GoalProgressMode, GoalStatus, MonthlyGoal } from "@/types";

const goalStatuses = new Set<GoalStatus>([
  "not_started",
  "in_progress",
  "completed",
  "paused",
]);
const goalProgressModes = new Set<GoalProgressMode>(["linked_items", "daily"]);

export interface CreateMonthlyGoalInput {
  id?: string;
  title: string;
  description: string;
  month: number;
  year: number;
  lifeArea: string;
  status: GoalStatus;
  progressMode: GoalProgressMode;
  progress: number;
  dueDate?: string;
  createdAt?: string;
}

export interface UpdateMonthlyGoalInput {
  title?: string;
  description?: string;
  month?: number;
  year?: number;
  lifeArea?: string;
  status?: GoalStatus;
  progressMode?: GoalProgressMode;
  progress?: number;
  dueDate?: string;
}

function formatDateOnly(value: Date | null) {
  if (!value) {
    return undefined;
  }

  return value.toISOString().slice(0, 10);
}

function parseDateOnly(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Use a valid due date.");
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

function clampProgress(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function mapPrismaMonthlyGoal(goal: PrismaMonthlyGoal): MonthlyGoal {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    month: goal.month,
    year: goal.year,
    lifeArea: goal.lifeArea,
    status: goal.status as GoalStatus,
    progressMode: goal.progressMode as GoalProgressMode,
    progress: goal.progress,
    dueDate: formatDateOnly(goal.dueDate),
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

function assertOwnedMonthlyGoal(
  goal: PrismaMonthlyGoal | null,
  userId: string,
) {
  if (!goal) {
    throw new Error("Monthly goal not found.");
  }

  if (goal.userId !== userId) {
    throw new Error("Monthly goal not found.");
  }

  return goal;
}

export async function listMonthlyGoalsForUser(userId: string) {
  const prisma = getPrismaClient();
  const goals = await prisma.monthlyGoal.findMany({
    where: { userId },
    orderBy: [
      { year: "desc" },
      { month: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  return goals.map(mapPrismaMonthlyGoal);
}

export async function createMonthlyGoalForUser(
  userId: string,
  input: CreateMonthlyGoalInput,
) {
  const prisma = getPrismaClient();
  const requestedId = input.id?.trim() || createId("monthly-goal");
  const createdAt = parseTimestamp(input.createdAt);

  const existingGoal = await prisma.monthlyGoal.findUnique({
    where: { id: requestedId },
  });

  if (existingGoal) {
    if (existingGoal.userId !== userId) {
      throw new Error("Monthly goal id already exists.");
    }

    return mapPrismaMonthlyGoal(existingGoal);
  }

  const createdGoal = await prisma.monthlyGoal.create({
    data: {
      id: requestedId,
      userId,
      title: input.title,
      description: input.description,
      month: input.month,
      year: input.year,
      lifeArea: input.lifeArea,
      status: input.status,
      progressMode: input.progressMode,
      progress: clampProgress(input.progress),
      dueDate: parseDateOnly(input.dueDate),
      ...(createdAt
        ? {
            createdAt,
          }
        : {}),
    },
  });

  return mapPrismaMonthlyGoal(createdGoal);
}

export async function updateMonthlyGoalForUser(
  userId: string,
  goalId: string,
  input: UpdateMonthlyGoalInput,
) {
  const prisma = getPrismaClient();
  const existingGoal = await prisma.monthlyGoal.findUnique({
    where: { id: goalId },
  });

  assertOwnedMonthlyGoal(existingGoal, userId);

  const updateData: Prisma.MonthlyGoalUpdateInput = {};

  if (input.title !== undefined) {
    updateData.title = input.title;
  }

  if (input.description !== undefined) {
    updateData.description = input.description;
  }

  if (input.month !== undefined) {
    updateData.month = input.month;
  }

  if (input.year !== undefined) {
    updateData.year = input.year;
  }

  if (input.lifeArea !== undefined) {
    updateData.lifeArea = input.lifeArea;
  }

  if (input.status !== undefined) {
    updateData.status = input.status;
  }

  if (input.progressMode !== undefined) {
    updateData.progressMode = input.progressMode;
  }

  if (input.progress !== undefined) {
    updateData.progress = clampProgress(input.progress);
  }

  if (input.dueDate !== undefined) {
    updateData.dueDate = parseDateOnly(input.dueDate);
  }

  const updatedGoal = await prisma.monthlyGoal.update({
    where: { id: goalId },
    data: updateData,
  });

  return mapPrismaMonthlyGoal(updatedGoal);
}

export async function deleteMonthlyGoalForUser(userId: string, goalId: string) {
  const prisma = getPrismaClient();
  const existingGoal = await prisma.monthlyGoal.findUnique({
    where: { id: goalId },
  });

  assertOwnedMonthlyGoal(existingGoal, userId);

  await prisma.$transaction(async (tx) => {
    await tx.weeklyGoal.updateMany({
      where: {
        userId,
        monthlyGoalId: goalId,
      },
      data: {
        monthlyGoalId: null,
      },
    });

    await tx.dailyTask.updateMany({
      where: {
        userId,
        monthlyGoalId: goalId,
      },
      data: {
        monthlyGoalId: null,
      },
    });

    await tx.monthlyGoal.delete({
      where: { id: goalId },
    });
  });
}

export function normalizeMonthlyGoalCreatePayload(
  body: unknown,
): CreateMonthlyGoalInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid monthly goal payload.");
  }

  const candidate = body as Record<string, unknown>;
  const title = typeof candidate.title === "string" ? candidate.title : "";
  const description =
    typeof candidate.description === "string" ? candidate.description : "";
  const lifeArea = typeof candidate.lifeArea === "string" ? candidate.lifeArea : "";
  const dueDate =
    typeof candidate.dueDate === "string" ? candidate.dueDate : undefined;
  const createdAt =
    typeof candidate.createdAt === "string" ? candidate.createdAt : undefined;
  const progress =
    typeof candidate.progress === "number" ? candidate.progress : 0;
  const progressMode =
    typeof candidate.progressMode === "string"
      ? candidate.progressMode
      : "linked_items";
  const month =
    typeof candidate.month === "number" ? candidate.month : Number.NaN;
  const year =
    typeof candidate.year === "number" ? candidate.year : Number.NaN;

  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    throw new Error("Use a valid month and year.");
  }

  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  if (!goalStatuses.has(candidate.status as GoalStatus)) {
    throw new Error("Use a valid monthly goal status.");
  }

  if (!goalProgressModes.has(progressMode as GoalProgressMode)) {
    throw new Error("Use a valid progress mode.");
  }

  return {
    id: typeof candidate.id === "string" ? candidate.id : undefined,
    title,
    description,
    month,
    year,
    lifeArea,
    status: candidate.status as GoalStatus,
    progressMode: progressMode as GoalProgressMode,
    progress,
    dueDate,
    createdAt,
  };
}

export function normalizeMonthlyGoalUpdatePayload(
  body: unknown,
): UpdateMonthlyGoalInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid monthly goal payload.");
  }

  const candidate = body as Record<string, unknown>;
  const update: UpdateMonthlyGoalInput = {};

  if (candidate.title !== undefined) {
    if (typeof candidate.title !== "string") {
      throw new Error("Use a valid title.");
    }
    update.title = candidate.title;
  }

  if (candidate.description !== undefined) {
    if (typeof candidate.description !== "string") {
      throw new Error("Use a valid description.");
    }
    update.description = candidate.description;
  }

  if (candidate.month !== undefined) {
    const month =
      typeof candidate.month === "number" ? candidate.month : Number.NaN;

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error("Month must be between 1 and 12.");
    }
    update.month = month;
  }

  if (candidate.year !== undefined) {
    const year = typeof candidate.year === "number" ? candidate.year : Number.NaN;

    if (!Number.isInteger(year)) {
      throw new Error("Use a valid year.");
    }
    update.year = year;
  }

  if (candidate.lifeArea !== undefined) {
    if (typeof candidate.lifeArea !== "string") {
      throw new Error("Use a valid life area.");
    }
    update.lifeArea = candidate.lifeArea;
  }

  if (candidate.status !== undefined) {
    if (!goalStatuses.has(candidate.status as GoalStatus)) {
      throw new Error("Use a valid monthly goal status.");
    }
    update.status = candidate.status as GoalStatus;
  }

  if (candidate.progressMode !== undefined) {
    if (
      typeof candidate.progressMode !== "string" ||
      !goalProgressModes.has(candidate.progressMode as GoalProgressMode)
    ) {
      throw new Error("Use a valid progress mode.");
    }
    update.progressMode = candidate.progressMode as GoalProgressMode;
  }

  if (candidate.progress !== undefined) {
    if (typeof candidate.progress !== "number") {
      throw new Error("Use a valid progress value.");
    }
    update.progress = candidate.progress;
  }

  if (candidate.dueDate !== undefined) {
    if (candidate.dueDate !== null && typeof candidate.dueDate !== "string") {
      throw new Error("Use a valid due date.");
    }
    update.dueDate = candidate.dueDate ?? undefined;
  }

  return update;
}
