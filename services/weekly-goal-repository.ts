import "server-only";

import { Prisma, type WeeklyGoal as PrismaWeeklyGoal } from "@prisma/client";
import { getISOWeek } from "date-fns";

import { getPrismaClient } from "@/lib/prisma";
import { createId } from "@/lib/utils";
import type { GoalStatus, WeeklyGoal } from "@/types";

const goalStatuses = new Set<GoalStatus>([
  "not_started",
  "in_progress",
  "completed",
  "paused",
]);

export interface CreateWeeklyGoalInput {
  id?: string;
  monthlyGoalId?: string | null;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  lifeArea: string;
  status: GoalStatus;
  progress: number;
  createdAt?: string;
}

export interface UpdateWeeklyGoalInput {
  monthlyGoalId?: string | null;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  lifeArea?: string;
  status?: GoalStatus;
  progress?: number;
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

function clampProgress(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function validateDateRange(startDate: Date, endDate: Date) {
  if (endDate.getTime() < startDate.getTime()) {
    throw new Error("End date cannot be before start date.");
  }
}

function mapPrismaWeeklyGoal(goal: PrismaWeeklyGoal): WeeklyGoal {
  return {
    id: goal.id,
    monthlyGoalId: goal.monthlyGoalId,
    title: goal.title,
    description: goal.description,
    weekNumber: goal.weekNumber,
    startDate: formatDateOnly(goal.startDate),
    endDate: formatDateOnly(goal.endDate),
    lifeArea: goal.lifeArea,
    status: goal.status as GoalStatus,
    progress: goal.progress,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

function assertOwnedWeeklyGoal(goal: PrismaWeeklyGoal | null, userId: string) {
  if (!goal) {
    throw new Error("Weekly goal not found.");
  }

  if (goal.userId !== userId) {
    throw new Error("Weekly goal not found.");
  }

  return goal;
}

async function assertOwnedMonthlyGoal(
  userId: string,
  monthlyGoalId: string | null | undefined,
) {
  if (!monthlyGoalId) {
    return null;
  }

  const prisma = getPrismaClient();
  const monthlyGoal = await prisma.monthlyGoal.findUnique({
    where: { id: monthlyGoalId },
  });

  if (!monthlyGoal || monthlyGoal.userId !== userId) {
    throw new Error("Monthly goal not found.");
  }

  return monthlyGoal;
}

export async function listWeeklyGoalsForUser(userId: string) {
  const prisma = getPrismaClient();
  const goals = await prisma.weeklyGoal.findMany({
    where: { userId },
    orderBy: [
      { startDate: "desc" },
      { endDate: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  return goals.map(mapPrismaWeeklyGoal);
}

export async function createWeeklyGoalForUser(
  userId: string,
  input: CreateWeeklyGoalInput,
) {
  const prisma = getPrismaClient();
  const requestedId = input.id?.trim() || createId("weekly-goal");
  const createdAt = parseTimestamp(input.createdAt);

  const existingGoal = await prisma.weeklyGoal.findUnique({
    where: { id: requestedId },
  });

  if (existingGoal) {
    if (existingGoal.userId !== userId) {
      throw new Error("Weekly goal id already exists.");
    }

    return mapPrismaWeeklyGoal(existingGoal);
  }

  await assertOwnedMonthlyGoal(userId, input.monthlyGoalId);

  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);
  validateDateRange(startDate, endDate);

  const createdGoal = await prisma.weeklyGoal.create({
    data: {
      id: requestedId,
      userId,
      monthlyGoalId: input.monthlyGoalId ?? null,
      title: input.title,
      description: input.description,
      weekNumber: getISOWeek(startDate),
      startDate,
      endDate,
      lifeArea: input.lifeArea,
      status: input.status,
      progress: clampProgress(input.progress),
      ...(createdAt
        ? {
            createdAt,
          }
        : {}),
    },
  });

  return mapPrismaWeeklyGoal(createdGoal);
}

export async function updateWeeklyGoalForUser(
  userId: string,
  goalId: string,
  input: UpdateWeeklyGoalInput,
) {
  const prisma = getPrismaClient();
  const existingGoal = await prisma.weeklyGoal.findUnique({
    where: { id: goalId },
  });

  const ownedGoal = assertOwnedWeeklyGoal(existingGoal, userId);

  if (input.monthlyGoalId !== undefined) {
    await assertOwnedMonthlyGoal(userId, input.monthlyGoalId);
  }

  const startDate =
    input.startDate !== undefined
      ? parseDateOnly(input.startDate)
      : ownedGoal.startDate;
  const endDate =
    input.endDate !== undefined ? parseDateOnly(input.endDate) : ownedGoal.endDate;
  validateDateRange(startDate, endDate);

  const updateData: Prisma.WeeklyGoalUncheckedUpdateInput = {};

  if (input.monthlyGoalId !== undefined) {
    updateData.monthlyGoalId = input.monthlyGoalId;
  }

  if (input.title !== undefined) {
    updateData.title = input.title;
  }

  if (input.description !== undefined) {
    updateData.description = input.description;
  }

  if (input.startDate !== undefined) {
    updateData.startDate = startDate;
    updateData.weekNumber = getISOWeek(startDate);
  }

  if (input.endDate !== undefined) {
    updateData.endDate = endDate;
  }

  if (input.lifeArea !== undefined) {
    updateData.lifeArea = input.lifeArea;
  }

  if (input.status !== undefined) {
    updateData.status = input.status;
  }

  if (input.progress !== undefined) {
    updateData.progress = clampProgress(input.progress);
  }

  const updatedGoal = await prisma.weeklyGoal.update({
    where: { id: goalId },
    data: updateData,
  });

  return mapPrismaWeeklyGoal(updatedGoal);
}

export async function deleteWeeklyGoalForUser(userId: string, goalId: string) {
  const prisma = getPrismaClient();
  const existingGoal = await prisma.weeklyGoal.findUnique({
    where: { id: goalId },
  });

  assertOwnedWeeklyGoal(existingGoal, userId);

  await prisma.$transaction([
    prisma.dailyTask.updateMany({
      where: {
        userId,
        weeklyGoalId: goalId,
      },
      data: {
        weeklyGoalId: null,
        updatedAt: new Date(),
      },
    }),
    prisma.weeklyGoal.delete({
      where: { id: goalId },
    }),
  ]);
}

export function normalizeWeeklyGoalCreatePayload(
  body: unknown,
): CreateWeeklyGoalInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid weekly goal payload.");
  }

  const candidate = body as Record<string, unknown>;
  const title = typeof candidate.title === "string" ? candidate.title : "";
  const description =
    typeof candidate.description === "string" ? candidate.description : "";
  const startDate =
    typeof candidate.startDate === "string" ? candidate.startDate : "";
  const endDate = typeof candidate.endDate === "string" ? candidate.endDate : "";
  const lifeArea = typeof candidate.lifeArea === "string" ? candidate.lifeArea : "";
  const monthlyGoalId =
    candidate.monthlyGoalId === null
      ? null
      : typeof candidate.monthlyGoalId === "string"
        ? candidate.monthlyGoalId
        : undefined;
  const createdAt =
    typeof candidate.createdAt === "string" ? candidate.createdAt : undefined;
  const progress =
    typeof candidate.progress === "number" ? candidate.progress : 0;

  if (!goalStatuses.has(candidate.status as GoalStatus)) {
    throw new Error("Use a valid weekly goal status.");
  }

  if (!startDate.trim() || !endDate.trim()) {
    throw new Error("Use a valid start and end date.");
  }

  return {
    id: typeof candidate.id === "string" ? candidate.id : undefined,
    monthlyGoalId,
    title,
    description,
    startDate,
    endDate,
    lifeArea,
    status: candidate.status as GoalStatus,
    progress,
    createdAt,
  };
}

export function normalizeWeeklyGoalUpdatePayload(
  body: unknown,
): UpdateWeeklyGoalInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid weekly goal payload.");
  }

  const candidate = body as Record<string, unknown>;
  const update: UpdateWeeklyGoalInput = {};

  if (candidate.monthlyGoalId !== undefined) {
    if (
      candidate.monthlyGoalId !== null &&
      typeof candidate.monthlyGoalId !== "string"
    ) {
      throw new Error("Use a valid monthly goal.");
    }

    update.monthlyGoalId = candidate.monthlyGoalId;
  }

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

  if (candidate.startDate !== undefined) {
    if (typeof candidate.startDate !== "string") {
      throw new Error("Use a valid start date.");
    }
    update.startDate = candidate.startDate;
  }

  if (candidate.endDate !== undefined) {
    if (typeof candidate.endDate !== "string") {
      throw new Error("Use a valid end date.");
    }
    update.endDate = candidate.endDate;
  }

  if (candidate.lifeArea !== undefined) {
    if (typeof candidate.lifeArea !== "string") {
      throw new Error("Use a valid life area.");
    }
    update.lifeArea = candidate.lifeArea;
  }

  if (candidate.status !== undefined) {
    if (!goalStatuses.has(candidate.status as GoalStatus)) {
      throw new Error("Use a valid weekly goal status.");
    }
    update.status = candidate.status as GoalStatus;
  }

  if (candidate.progress !== undefined) {
    if (typeof candidate.progress !== "number") {
      throw new Error("Use a valid progress value.");
    }
    update.progress = candidate.progress;
  }

  return update;
}
