"use client";

import Link from "next/link";
import { addMonths } from "date-fns";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { GoalCard } from "@/components/goal-card";
import { PageHeader } from "@/components/page-header";
import { LifeAreaManager, MonthlyGoalForm } from "@/components/planner-forms";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/hooks/use-language";
import { formatMonthLabel, getMonthKey, getMonthKeyForDate } from "@/lib/date";
import { getWeeklyGoalsForMonth } from "@/services/planning-service";
import type { MonthlyGoal } from "@/types";

const RECENT_PAST_MONTHS = 6;

interface MonthSection {
  key: string;
  month: number;
  year: number;
  label: string;
  goals: MonthlyGoal[];
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
}

function sortMonthlyGoals(goals: MonthlyGoal[]) {
  return [...goals].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function getMonthSectionSummary(goalsCount: number, language: "nl" | "en") {
  const goalLabel =
    language === "nl"
      ? goalsCount === 1
        ? "doel"
        : "doelen"
      : goalsCount === 1
        ? "goal"
        : "goals";

  return `${goalsCount} ${goalLabel}`;
}

function getEmptyMonthHint(section: MonthSection, language: "nl" | "en") {
  if (section.isPast) {
    return language === "nl"
      ? "Je kunt alsnog een maanddoel aan deze maand toevoegen."
      : "You can still add a monthly goal to this month.";
  }

  if (section.isFuture) {
    return language === "nl"
      ? "Voeg een doel toe als je alvast vooruit wilt plannen."
      : "Add a goal if you want to plan ahead.";
  }

  return language === "nl"
    ? "Voeg een of twee doelen toe voor deze maand."
    : "Add one or two goals for this month.";
}

export default function MonthlyPlanningPage() {
  const { t, language } = useLanguage();
  const {
    state,
    addMonthlyGoal,
    updateMonthlyGoal,
    deleteMonthlyGoal,
    addLifeArea,
  } = useAppState();

  const [formTargetMonthKey, setFormTargetMonthKey] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [expandedMonthKeys, setExpandedMonthKeys] = useState<string[]>([]);

  const currentDate = useMemo(() => new Date(), []);
  const currentMonthKey = getMonthKeyForDate(currentDate);

  const monthSections = useMemo(() => {
    const keys = new Set<string>([currentMonthKey]);

    for (let offset = 1; offset <= RECENT_PAST_MONTHS; offset += 1) {
      keys.add(getMonthKeyForDate(addMonths(currentDate, -offset)));
    }

    state.monthlyGoals.forEach((goal) => {
      keys.add(getMonthKey(goal.month, goal.year));
    });

    return Array.from(keys)
      .sort((left, right) => right.localeCompare(left))
      .map((key) => {
        const [year, month] = key.split("-").map(Number);

        return {
          key,
          month,
          year,
          label: formatMonthLabel(month, year, language),
          goals: sortMonthlyGoals(
            state.monthlyGoals.filter(
              (goal) => goal.month === month && goal.year === year,
            ),
          ),
          isCurrent: key === currentMonthKey,
          isPast: key < currentMonthKey,
          isFuture: key > currentMonthKey,
        } satisfies MonthSection;
      });
  }, [currentDate, currentMonthKey, language, state.monthlyGoals]);

  const currentSection =
    monthSections.find((section) => section.isCurrent) ??
    ({
      key: currentMonthKey,
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      label: formatMonthLabel(currentDate.getMonth() + 1, currentDate.getFullYear(), language),
      goals: [],
      isCurrent: true,
      isPast: false,
      isFuture: false,
    } satisfies MonthSection);
  const futureSections = monthSections.filter((section) => section.isFuture);
  const pastSections = monthSections.filter((section) => section.isPast);
  const editingGoal = state.monthlyGoals.find((goal) => goal.id === editingGoalId);
  const activeFormMonthKey =
    editingGoal != null
      ? getMonthKey(editingGoal.month, editingGoal.year)
      : formTargetMonthKey;

  function toggleMonthSection(key: string) {
    setExpandedMonthKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key],
    );
  }

  function openMonthForm(key: string) {
    setFormTargetMonthKey(key);
    setEditingGoalId(null);
    setExpandedMonthKeys((currentKeys) =>
      currentKeys.includes(key) ? currentKeys : [...currentKeys, key],
    );
  }

  function startEditing(goalId: string, monthKey: string) {
    setEditingGoalId(goalId);
    setFormTargetMonthKey(null);
    setExpandedMonthKeys((currentKeys) =>
      currentKeys.includes(monthKey) ? currentKeys : [...currentKeys, monthKey],
    );
  }

  function closeMonthlyForm() {
    setFormTargetMonthKey(null);
    setEditingGoalId(null);
  }

  function renderSectionContent(section: MonthSection) {
    const showForm = activeFormMonthKey === section.key;

    return (
      <div className="space-y-5">
        {showForm ? (
          <MonthlyGoalForm
            key={editingGoal?.id ?? `${section.key}-new-monthly-goal`}
            initialValue={editingGoal}
            lifeAreas={state.lifeAreas}
            defaultMonth={section.month}
            defaultYear={section.year}
            onSubmit={(value) => {
              if (editingGoal) {
                updateMonthlyGoal(editingGoal.id, value);
              } else {
                addMonthlyGoal(value);
              }
              closeMonthlyForm();
            }}
            onCancel={closeMonthlyForm}
          />
        ) : null}

        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("planning.monthPage.goals")}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {t("planning.monthPage.goalsHint")}
            </p>
          </div>

          {section.goals.length > 0 ? (
            section.goals.map((goal) => {
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
                  onEdit={() => startEditing(goal.id, section.key)}
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
              description={getEmptyMonthHint(section, language)}
            />
          )}
        </section>
      </div>
    );
  }

  function renderCollapsibleSection(section: MonthSection) {
    const isOpen = expandedMonthKeys.includes(section.key);

    return (
      <section key={section.key} className="app-surface app-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => toggleMonthSection(section.key)}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            {isOpen ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--muted)]" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--muted)]" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold capitalize text-[color:var(--foreground)]">
                {section.label}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {getMonthSectionSummary(section.goals.length, language)}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openMonthForm(section.key)}
            className="app-button-secondary text-sm"
          >
            <Plus className="h-4 w-4" />
            {t("form.addGoal")}
          </button>
        </div>

        {isOpen ? <div className="mt-5">{renderSectionContent(section)}</div> : null}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("planning.eyebrow")}
        title={t("planning.monthPage.title")}
        description={t("planning.monthPage.description")}
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/planning/week" className="app-button-secondary text-sm">
              {t("planning.week.title")}
            </Link>
          </div>
        }
      />

      <section className="app-surface-strong app-panel-lg space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="app-label">{t("planning.monthPage.current")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] capitalize text-[color:var(--foreground)]">
              {currentSection.label}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => openMonthForm(currentSection.key)}
            className="app-button-primary text-sm"
          >
            <Plus className="h-4 w-4" />
            {t("form.addGoal")}
          </button>
        </div>

        {renderSectionContent(currentSection)}
      </section>

      {futureSections.length > 0 ? (
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("planning.monthPage.future")}
            </p>
          </div>
          {futureSections.map((section) => renderCollapsibleSection(section))}
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {t("planning.monthPage.previous")}
          </p>
        </div>
        {pastSections.map((section) => renderCollapsibleSection(section))}
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
  );
}
