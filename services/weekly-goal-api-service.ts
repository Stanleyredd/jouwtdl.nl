"use client";

import type { WeeklyGoal } from "@/types";

export interface WeeklyGoalApiCreateInput {
  id?: string;
  monthlyGoalId?: string | null;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  lifeArea: string;
  status: WeeklyGoal["status"];
  progress: number;
  createdAt?: string;
}

export interface WeeklyGoalApiUpdateInput {
  monthlyGoalId?: string | null;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  lifeArea?: string;
  status?: WeeklyGoal["status"];
  progress?: number;
}

async function parseWeeklyGoalResponse<T>(
  response: Response,
): Promise<{ data: T | null; error: string | null }> {
  const data = (await response.json().catch(() => null)) as
    | {
        error?: string;
        weeklyGoal?: T;
        weeklyGoals?: T;
      }
    | null;

  if (!response.ok) {
    return {
      data: null,
      error: data?.error ?? "Weekly goals could not be saved right now.",
    };
  }

  return {
    data: (data?.weeklyGoal ?? data?.weeklyGoals ?? null) as T | null,
    error: null,
  };
}

export async function listWeeklyGoals() {
  const response = await fetch("/api/weekly-goals", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const result = await parseWeeklyGoalResponse<WeeklyGoal[]>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Weekly goals could not be loaded right now.");
  }

  return result.data;
}

export async function createWeeklyGoal(input: WeeklyGoalApiCreateInput) {
  const response = await fetch("/api/weekly-goals", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await parseWeeklyGoalResponse<WeeklyGoal>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Weekly goal could not be created right now.");
  }

  return result.data;
}

export async function updateWeeklyGoalById(
  id: string,
  input: WeeklyGoalApiUpdateInput,
) {
  const response = await fetch(`/api/weekly-goals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await parseWeeklyGoalResponse<WeeklyGoal>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Weekly goal could not be updated right now.");
  }

  return result.data;
}

export async function deleteWeeklyGoalById(id: string) {
  const response = await fetch(`/api/weekly-goals/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (response.ok) {
    return;
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  throw new Error(data?.error ?? "Weekly goal could not be deleted right now.");
}
