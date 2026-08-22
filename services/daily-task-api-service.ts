"use client";

import type { DailyTask } from "@/types";

export interface DailyTaskApiCreateInput {
  id?: string;
  weeklyGoalId?: string | null;
  monthlyGoalId?: string | null;
  title: string;
  note: string;
  date: string;
  priority: DailyTask["priority"];
  lifeArea: string;
  completed: boolean;
  carryOverCount: number;
  createdAt?: string;
}

export interface DailyTaskApiUpdateInput {
  weeklyGoalId?: string | null;
  monthlyGoalId?: string | null;
  title?: string;
  note?: string;
  date?: string;
  priority?: DailyTask["priority"];
  lifeArea?: string;
  completed?: boolean;
  carryOverCount?: number;
}

async function parseDailyTaskResponse<T>(
  response: Response,
): Promise<{ data: T | null; error: string | null }> {
  const data = (await response.json().catch(() => null)) as
    | {
        error?: string;
        dailyTask?: T;
        dailyTasks?: T;
      }
    | null;

  if (!response.ok) {
    return {
      data: null,
      error: data?.error ?? "Daily tasks could not be saved right now.",
    };
  }

  return {
    data: (data?.dailyTask ?? data?.dailyTasks ?? null) as T | null,
    error: null,
  };
}

export async function listDailyTasks() {
  const response = await fetch("/api/daily-tasks", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const result = await parseDailyTaskResponse<DailyTask[]>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Daily tasks could not be loaded right now.");
  }

  return result.data;
}

export async function createDailyTask(input: DailyTaskApiCreateInput) {
  const response = await fetch("/api/daily-tasks", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await parseDailyTaskResponse<DailyTask>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Daily task could not be created right now.");
  }

  return result.data;
}

export async function updateDailyTaskById(
  id: string,
  input: DailyTaskApiUpdateInput,
) {
  const response = await fetch(`/api/daily-tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await parseDailyTaskResponse<DailyTask>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Daily task could not be updated right now.");
  }

  return result.data;
}

export async function deleteDailyTaskById(id: string) {
  const response = await fetch(`/api/daily-tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (response.ok) {
    return;
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  throw new Error(data?.error ?? "Daily task could not be deleted right now.");
}
