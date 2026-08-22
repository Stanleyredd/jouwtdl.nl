"use client";

import { useMemo, useState } from "react";
import { Check, PencilLine, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { useLanguage } from "@/hooks/use-language";
import { translateLifeAreaName } from "@/lib/i18n";
import {
  getMonthlyGoalsForDate,
  getWeeklyGoalsForDate,
} from "@/services/planning-service";
import { cn } from "@/lib/utils";
import type {
  DailyTask,
  MonthlyGoal,
  TaskPriority,
  WeeklyGoal,
} from "@/types";

interface TaskListProps {
  tasks: DailyTask[];
  monthlyGoals: MonthlyGoal[];
  weeklyGoalLookup: Record<string, WeeklyGoal | undefined>;
  lifeAreas: string[];
  emptyTitle: string;
  emptyDescription: string;
  showDate?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onSave: (
    taskId: string,
    updates: Partial<
      Pick<
        DailyTask,
        | "title"
        | "note"
        | "priority"
        | "date"
        | "lifeArea"
        | "weeklyGoalId"
        | "monthlyGoalId"
      >
    >,
  ) => void;
}

interface EditorState {
  title: string;
  note: string;
  priority: TaskPriority;
  date: string;
  lifeArea: string;
  weeklyGoalId: string;
  monthlyGoalId: string;
}

export function TaskList({
  tasks,
  monthlyGoals,
  weeklyGoalLookup,
  lifeAreas,
  emptyTitle,
  emptyDescription,
  showDate = false,
  onToggle,
  onDelete,
  onSave,
}: TaskListProps) {
  const { t, language } = useLanguage();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const weeklyGoals = useMemo(
    () =>
      Object.values(weeklyGoalLookup).filter(
        (goal): goal is WeeklyGoal => Boolean(goal),
      ),
    [weeklyGoalLookup],
  );

  function startEditing(task: DailyTask) {
    setEditingTaskId(task.id);
    setEditorState({
      title: task.title,
      note: task.note,
      priority: task.priority,
      date: task.date,
      lifeArea: task.lifeArea,
      weeklyGoalId: task.weeklyGoalId ?? "",
      monthlyGoalId: task.monthlyGoalId ?? "",
    });
  }

  if (tasks.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="app-surface overflow-hidden rounded-[22px]">
      {tasks.map((task) => {
        const isEditing = editingTaskId === task.id && editorState;
        const parentGoal = task.weeklyGoalId ? weeklyGoalLookup[task.weeklyGoalId] : undefined;
        const availableWeeklyGoals =
          isEditing && editorState
            ? getWeeklyGoalsForDate(weeklyGoals, editorState.date)
            : weeklyGoals;
        const availableMonthlyGoals =
          isEditing && editorState
            ? getMonthlyGoalsForDate(monthlyGoals, editorState.date)
            : monthlyGoals;
        const selectedWeeklyGoal =
          isEditing && editorState.weeklyGoalId
            ? weeklyGoalLookup[editorState.weeklyGoalId]
            : undefined;
        const selectedMonthlyGoal =
          isEditing && editorState.monthlyGoalId
            ? monthlyGoals.find((goal) => goal.id === editorState.monthlyGoalId)
            : undefined;
        const preserveExistingWeeklyGoal =
          Boolean(
            isEditing &&
              task.weeklyGoalId &&
              task.weeklyGoalId === editorState.weeklyGoalId &&
              task.date === editorState.date,
          );
        const preserveExistingMonthlyGoal =
          Boolean(
            isEditing &&
              task.monthlyGoalId &&
              task.monthlyGoalId === editorState.monthlyGoalId &&
              task.date === editorState.date,
          );
        const visibleWeeklyGoals =
          selectedWeeklyGoal &&
          preserveExistingWeeklyGoal &&
          !availableWeeklyGoals.some((goal) => goal.id === selectedWeeklyGoal.id)
            ? [...availableWeeklyGoals, selectedWeeklyGoal]
            : availableWeeklyGoals;
        const weeklyGoalMonthlyGoalId =
          selectedWeeklyGoal?.monthlyGoalId &&
          availableMonthlyGoals.some(
            (goal) => goal.id === selectedWeeklyGoal.monthlyGoalId,
          )
            ? selectedWeeklyGoal.monthlyGoalId
            : "";
        const effectiveMonthlyGoalId =
          isEditing &&
          editorState.monthlyGoalId &&
          (availableMonthlyGoals.some(
            (goal) => goal.id === editorState.monthlyGoalId,
          ) ||
            preserveExistingMonthlyGoal)
            ? editorState.monthlyGoalId
            : weeklyGoalMonthlyGoalId ||
                (availableMonthlyGoals.length === 1
                  ? availableMonthlyGoals[0]?.id ?? ""
                  : "");
        const visibleMonthlyGoals =
          selectedMonthlyGoal &&
          preserveExistingMonthlyGoal &&
          !availableMonthlyGoals.some((goal) => goal.id === selectedMonthlyGoal.id)
            ? [...availableMonthlyGoals, selectedMonthlyGoal]
            : availableMonthlyGoals;
        const metaParts = [
          showDate ? task.date : null,
          t("task.week", { value: parentGoal?.title ?? t("common.other") }),
          task.carryOverCount > 0
            ? t("task.stillOpen", { count: task.carryOverCount })
            : null,
        ].filter(Boolean) as string[];

        return (
          <div
            key={task.id}
            className={cn(
              "border-b border-[color:var(--border)] px-4 py-4 transition last:border-b-0 sm:px-5",
              task.completed ? "opacity-60" : "",
            )}
          >
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => onToggle(task.id)}
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
                  task.completed
                    ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-strong)] text-[color:var(--accent-contrast)]"
                    : "border-[color:var(--border-strong)] bg-[color:var(--surface-overlay-strong)] text-transparent hover:border-[color:var(--accent-strong)]",
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-[15px] font-medium tracking-[-0.01em] text-[color:var(--foreground)]",
                        task.completed ? "line-through decoration-[color:var(--muted-soft)]" : "",
                      )}
                    >
                      {task.title}
                    </p>
                    {metaParts.length > 0 ? (
                      <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                        {metaParts.join(" · ")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditing(task)}
                    className="app-icon-button"
                      title={t("task.edit")}
                      aria-label={t("task.edit")}
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(task.id)}
                      className="app-icon-button"
                      title={t("task.delete")}
                      aria-label={t("task.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {task.note ? (
                  <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">
                    {task.note}
                  </p>
                ) : null}
              </div>
            </div>

            {isEditing ? (
              <div className="app-surface-soft mt-4 grid gap-3 rounded-[18px] p-4">
                <input
                  value={editorState.title}
                  onChange={(event) =>
                    setEditorState({ ...editorState, title: event.target.value })
                  }
                  className="app-input"
                />
                <textarea
                  value={editorState.note}
                  onChange={(event) =>
                    setEditorState({ ...editorState, note: event.target.value })
                  }
                  rows={2}
                  className="app-input"
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <select
                    value={editorState.weeklyGoalId}
                    onChange={(event) =>
                      setEditorState({
                        ...editorState,
                        weeklyGoalId: event.target.value,
                      })
                    }
                    className="app-input"
                  >
                    <option value="">{t("common.other")}</option>
                    {visibleWeeklyGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={effectiveMonthlyGoalId}
                    onChange={(event) =>
                      setEditorState({
                        ...editorState,
                        monthlyGoalId: event.target.value,
                      })
                    }
                    className="app-input"
                  >
                    <option value="">{t("common.other")}</option>
                    {visibleMonthlyGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editorState.priority}
                    onChange={(event) =>
                      setEditorState({
                        ...editorState,
                        priority: event.target.value as TaskPriority,
                      })
                    }
                    className="app-input"
                  >
                    <option value="high">{t("form.priorityHigh")}</option>
                    <option value="medium">{t("form.priorityMedium")}</option>
                    <option value="low">{t("form.priorityLow")}</option>
                  </select>
                  <input
                    type="date"
                    value={editorState.date}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      const nextWeeklyGoals = getWeeklyGoalsForDate(
                        weeklyGoals,
                        nextDate,
                      );
                      const shouldKeepWeeklyGoal =
                        !editorState.weeklyGoalId ||
                        nextWeeklyGoals.some(
                          (goal) => goal.id === editorState.weeklyGoalId,
                        );

                      setEditorState({
                        ...editorState,
                        date: nextDate,
                        weeklyGoalId: shouldKeepWeeklyGoal
                          ? editorState.weeklyGoalId
                          : "",
                        monthlyGoalId:
                          !editorState.monthlyGoalId ||
                          getMonthlyGoalsForDate(monthlyGoals, nextDate).some(
                            (goal) => goal.id === editorState.monthlyGoalId,
                          )
                            ? editorState.monthlyGoalId
                            : "",
                      });
                    }}
                    className="app-input"
                  />
                  <select
                    value={editorState.lifeArea}
                    onChange={(event) =>
                      setEditorState({ ...editorState, lifeArea: event.target.value })
                    }
                    className="app-input"
                  >
                    {lifeAreas.map((lifeArea) => (
                      <option key={lifeArea} value={lifeArea}>
                        {translateLifeAreaName(lifeArea, language)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSave(task.id, {
                        ...editorState,
                        weeklyGoalId: editorState.weeklyGoalId || null,
                        monthlyGoalId: effectiveMonthlyGoalId || null,
                      });
                      setEditingTaskId(null);
                      setEditorState(null);
                    }}
                    className="app-button-primary text-sm"
                  >
                    {t("task.save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTaskId(null);
                      setEditorState(null);
                    }}
                    className="app-button-secondary text-sm"
                  >
                    {t("task.cancel")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
