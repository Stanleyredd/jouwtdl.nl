"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { GoalCard } from "@/components/goal-card";
import { PageHeader } from "@/components/page-header";
import { LifeAreaManager, MonthlyGoalForm } from "@/components/planner-forms";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/hooks/use-language";
import { formatMonthLabel } from "@/lib/date";
import { getWeeklyGoalsForMonth } from "@/services/planning-service";

export default function MonthlyPlanningPage() {
  const { t, language } = useLanguage();
  const {
    state,
    addMonthlyGoal,
    updateMonthlyGoal,
    deleteMonthlyGoal,
    addLifeArea,
  } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  const editingGoal = state.monthlyGoals.find((goal) => goal.id === editingGoalId);
  const goals = useMemo(() => {
    return [...state.monthlyGoals].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }, [state.monthlyGoals]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("planning.eyebrow")}
        title={t("planning.monthPage.title")}
        description={t("planning.monthPage.description")}
        action={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setShowForm((current) => !current);
                setEditingGoalId(null);
              }}
              className="app-button-primary text-sm"
            >
              <Plus className="h-4 w-4" />
              {showForm ? t("common.close") : t("form.addGoal")}
            </button>
            <Link href="/planning/week" className="app-button-secondary text-sm">
              {t("planning.week.title")}
            </Link>
          </div>
        }
      />

      {showForm || editingGoal ? (
        <MonthlyGoalForm
          key={editingGoal?.id ?? "new-monthly-goal"}
          initialValue={editingGoal}
          lifeAreas={state.lifeAreas}
          onSubmit={(value) => {
            if (editingGoal) {
              updateMonthlyGoal(editingGoal.id, value);
            } else {
              addMonthlyGoal(value);
            }
            setShowForm(false);
            setEditingGoalId(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingGoalId(null);
          }}
        />
      ) : null}

      <div className="space-y-5">
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("planning.monthPage.goals")}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {t("planning.monthPage.goalsHint")}
            </p>
          </div>

          {goals.length > 0 ? (
            goals.map((goal) => {
              const linkedWeeklyGoals = getWeeklyGoalsForMonth(state.weeklyGoals, goal.id);

              return (
                <GoalCard
                  key={goal.id}
                  title={goal.title}
                  description={goal.description}
                  lifeArea={goal.lifeArea}
                  status={goal.status}
                  progress={goal.progress}
                  meta={formatMonthLabel(goal.month, goal.year, language)}
                  linkedCount={linkedWeeklyGoals.length}
                  onEdit={() => {
                    setEditingGoalId(goal.id);
                    setShowForm(false);
                  }}
                  onDelete={() => deleteMonthlyGoal(goal.id)}
                >
                  {linkedWeeklyGoals.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {linkedWeeklyGoals.slice(0, 3).map((linkedGoal) => (
                        <span key={linkedGoal.id} className="app-chip-muted">
                          {linkedGoal.title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </GoalCard>
              );
            })
          ) : (
            <EmptyState
              title={t("planning.monthPage.noGoals")}
              description={t("planning.monthPage.noGoalsHint")}
            />
          )}
        </section>

        <section className="space-y-4">
          <LifeAreaManager lifeAreas={state.lifeAreas} onAdd={addLifeArea} />
          <section className="app-surface app-panel">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("planning.monthPage.nextStep")}
            </p>
            <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">
              {t("planning.monthPage.nextStepHint")}
            </p>
          </section>
        </section>
      </div>
    </div>
  );
}
