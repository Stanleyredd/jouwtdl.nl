"use client";

import type { MonthlyGoal } from "@/types";

export interface MonthlyGoalApiCreateInput {
  id?: string;
  title: string;
  description: string;
  month: number;
  year: number;
  lifeArea: string;
  status: MonthlyGoal["status"];
  progressMode: MonthlyGoal["progressMode"];
  progress: number;
  dueDate?: string;
  createdAt?: string;
}

export interface MonthlyGoalApiUpdateInput {
  title?: string;
  description?: string;
  month?: number;
  year?: number;
  lifeArea?: string;
  status?: MonthlyGoal["status"];
  progressMode?: MonthlyGoal["progressMode"];
  progress?: number;
  dueDate?: string;
}

async function parseMonthlyGoalResponse<T>(
  response: Response,
): Promise<{ data: T | null; error: string | null }> {
  const data = (await response.json().catch(() => null)) as
    | {
        error?: string;
        monthlyGoal?: T;
        monthlyGoals?: T;
      }
    | null;

  if (!response.ok) {
    return {
      data: null,
      error: data?.error ?? "Monthly goals could not be saved right now.",
    };
  }

  return {
    data: (data?.monthlyGoal ?? data?.monthlyGoals ?? null) as T | null,
    error: null,
  };
}

export async function listMonthlyGoals() {
  const response = await fetch("/api/monthly-goals", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const result = await parseMonthlyGoalResponse<MonthlyGoal[]>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Monthly goals could not be loaded right now.");
  }

  return result.data;
}

export async function createMonthlyGoal(input: MonthlyGoalApiCreateInput) {
  const response = await fetch("/api/monthly-goals", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await parseMonthlyGoalResponse<MonthlyGoal>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Monthly goal could not be created right now.");
  }

  return result.data;
}

export async function updateMonthlyGoalById(
  id: string,
  input: MonthlyGoalApiUpdateInput,
) {
  const response = await fetch(`/api/monthly-goals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await parseMonthlyGoalResponse<MonthlyGoal>(response);

  if (!result.data) {
    throw new Error(result.error ?? "Monthly goal could not be updated right now.");
  }

  return result.data;
}

export async function deleteMonthlyGoalById(id: string) {
  const response = await fetch(`/api/monthly-goals/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (response.ok) {
    return;
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  throw new Error(data?.error ?? "Monthly goal could not be deleted right now.");
}
