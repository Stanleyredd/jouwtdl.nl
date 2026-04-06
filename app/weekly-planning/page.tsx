"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { GoalCard } from "@/components/goal-card";
import { PageHeader } from "@/components/page-header";
import { WeeklyGoalForm } from "@/components/planner-forms";
import { TaskList } from "@/components/task-list";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/hooks/use-language";
import { getWeekRange } from "@/lib/date";
import {
  getTasksForWeeklyGoal,
  getWeeklyGoalsInRange,
} from "@/services/planning-service";

export default function WeeklyPlanningPage() {
  const { t, language } = useLanguage();
  const {
    state,
    addWeeklyGoal,
    updateWeeklyGoal,
    deleteWeeklyGoal,
    updateDailyTask,
    deleteDailyTask,
    toggleTask,
  } = useAppState();

  const currentWeek = getWeekRange(new Date());
  const [showWeeklyForm, setShowWeeklyForm] = useState(false);
  const [editingWeeklyGoalId, setEditingWeeklyGoalId] = useState<string | null>(null);

  const editingWeeklyGoal = state.weeklyGoals.find((goal) => goal.id === editingWeeklyGoalId);
  const weeklyGoals = getWeeklyGoalsInRange(
    state.weeklyGoals,
    currentWeek.startKey,
    currentWeek.endKey,
  );
  const weeklyGoalLookup = Object.fromEntries(
    state.weeklyGoals.map((goal) => [goal.id, goal]),
  );
  const monthlyGoalLookup = Object.fromEntries(
    state.monthlyGoals.map((goal) => [goal.id, goal]),
  );

  const sortedWeeklyGoals = useMemo(() => {
    return [...weeklyGoals].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }, [weeklyGoals]);

  const allWeekTasks = state.dailyTasks.filter(
    (task) => task.date >= currentWeek.startKey && task.date <= currentWeek.endKey,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("planning.eyebrow")}
        title={t("planning.weekPage.title")}
        description={t("planning.weekPage.description")}
        action={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setShowWeeklyForm((current) => !current);
                setEditingWeeklyGoalId(null);
              }}
              className="app-button-primary text-sm"
            >
              <Plus className="h-4 w-4" />
              {showWeeklyForm ? t("common.close") : t("form.addGoal")}
            </button>
            <Link href="/planning/day" className="app-button-secondary text-sm">
              {t("planning.day.title")}
            </Link>
            <Link href="/planning/month" className="app-button-secondary text-sm">
              {t("planning.month.title")}
            </Link>
          </div>
        }
      />

      {showWeeklyForm || editingWeeklyGoal ? (
        <WeeklyGoalForm
          key={editingWeeklyGoal?.id ?? "new-weekly-goal"}
          initialValue={editingWeeklyGoal}
          monthlyGoals={state.monthlyGoals}
          lifeAreas={state.lifeAreas}
          onSubmit={(value) => {
            if (editingWeeklyGoal) {
              updateWeeklyGoal(editingWeeklyGoal.id, value);
            } else {
              addWeeklyGoal(value);
            }
            setShowWeeklyForm(false);
            setEditingWeeklyGoalId(null);
          }}
          onCancel={() => {
            setShowWeeklyForm(false);
            setEditingWeeklyGoalId(null);
          }}
        />
      ) : null}

      <div className="space-y-5">
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("planning.weekPage.goals")}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {t("planning.weekPage.goalsHint")}
            </p>
          </div>

          {sortedWeeklyGoals.length > 0 ? (
            sortedWeeklyGoals.map((goal) => {
              const linkedTasks = getTasksForWeeklyGoal(state.dailyTasks, goal.id);
              return (
                <GoalCard
                  key={goal.id}
                  title={goal.title}
                  description={goal.description}
                  lifeArea={goal.lifeArea}
                  status={goal.status}
                  progress={goal.progress}
                  meta={language === "nl" ? `${goal.startDate} t/m ${goal.endDate}` : `${goal.startDate} to ${goal.endDate}`}
                  parentLabel={t("task.month", {
                    value: goal.monthlyGoalId
                      ? (monthlyGoalLookup[goal.monthlyGoalId]?.title ?? t("common.other"))
                      : t("common.other"),
                  })}
                  linkedCount={linkedTasks.length}
                  onEdit={() => {
                    setEditingWeeklyGoalId(goal.id);
                    setShowWeeklyForm(false);
                  }}
                  onDelete={() => deleteWeeklyGoal(goal.id)}
                >
                  {linkedTasks.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {linkedTasks.slice(0, 3).map((task) => (
                        <span key={task.id} className="app-chip-muted">
                          {task.title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </GoalCard>
              );
            })
          ) : (
            <EmptyState
              title={t("planning.weekPage.noGoals")}
              description={t("planning.weekPage.noGoalsHint")}
            />
          )}
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("planning.weekPage.dailyTasks")}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {t("planning.weekPage.dailyTasksHint")}
            </p>
          </div>
          <TaskList
            tasks={allWeekTasks}
            weeklyGoalLookup={weeklyGoalLookup}
            lifeAreas={state.lifeAreas}
            emptyTitle={t("today.noTasks")}
            emptyDescription={t("planning.day.title")}
            showDate
            onToggle={toggleTask}
            onDelete={deleteDailyTask}
            onSave={updateDailyTask}
          />
        </section>
      </div>
    </div>
  );
}
