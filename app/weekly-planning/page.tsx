"use client";

import Link from "next/link";
import { addWeeks } from "date-fns";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { GoalCard } from "@/components/goal-card";
import { PageHeader } from "@/components/page-header";
import { WeeklyGoalForm } from "@/components/planner-forms";
import { TaskList } from "@/components/task-list";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/hooks/use-language";
import { formatWeekHeading, getWeekRange } from "@/lib/date";
import { getTasksForWeeklyGoal } from "@/services/planning-service";
import type { DailyTask, WeeklyGoal } from "@/types";

const RECENT_PAST_WEEKS = 8;

interface WeekSection {
  key: string;
  range: ReturnType<typeof getWeekRange>;
  goals: WeeklyGoal[];
  tasks: DailyTask[];
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
}

function sortWeeklyGoals(goals: WeeklyGoal[]) {
  return [...goals].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function sortWeekTasks(tasks: DailyTask[]) {
  const priorityRank = { high: 0, medium: 1, low: 2 };

  return [...tasks].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    if (left.completed !== right.completed) {
      return Number(left.completed) - Number(right.completed);
    }

    return priorityRank[left.priority] - priorityRank[right.priority];
  });
}

function getWeekSectionSummary(
  goalsCount: number,
  tasksCount: number,
  language: "nl" | "en",
) {
  const goalLabel =
    language === "nl"
      ? goalsCount === 1
        ? "doel"
        : "doelen"
      : goalsCount === 1
        ? "goal"
        : "goals";
  const taskLabel =
    language === "nl"
      ? tasksCount === 1
        ? "taak"
        : "taken"
      : tasksCount === 1
        ? "task"
        : "tasks";

  return `${goalsCount} ${goalLabel} · ${tasksCount} ${taskLabel}`;
}

function getEmptyWeekHint(section: WeekSection, language: "nl" | "en") {
  if (section.isPast) {
    return language === "nl"
      ? "Je kunt alsnog een weekdoel aan deze week toevoegen."
      : "You can still add a weekly goal to this week.";
  }

  if (section.isFuture) {
    return language === "nl"
      ? "Voeg een doel toe als je alvast vooruit wilt plannen."
      : "Add a goal if you want to plan ahead.";
  }

  return language === "nl"
    ? "Voeg een of twee doelen toe voor deze week."
    : "Add one or two goals for this week.";
}

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

  const [formTargetWeekKey, setFormTargetWeekKey] = useState<string | null>(null);
  const [editingWeeklyGoalId, setEditingWeeklyGoalId] = useState<string | null>(null);
  const [expandedWeekKeys, setExpandedWeekKeys] = useState<string[]>([]);

  const currentWeek = useMemo(() => getWeekRange(new Date(), language), [language]);
  const currentWeekKey = currentWeek.startKey;

  const weeklyGoalLookup = Object.fromEntries(
    state.weeklyGoals.map((goal) => [goal.id, goal]),
  );
  const monthlyGoalLookup = Object.fromEntries(
    state.monthlyGoals.map((goal) => [goal.id, goal]),
  );

  const weekSections = useMemo(() => {
    const keys = new Set<string>([currentWeekKey]);

    for (let offset = 1; offset <= RECENT_PAST_WEEKS; offset += 1) {
      keys.add(getWeekRange(addWeeks(currentWeek.start, -offset)).startKey);
    }

    state.weeklyGoals.forEach((goal) => {
      keys.add(getWeekRange(goal.startDate).startKey);
    });

    state.dailyTasks.forEach((task) => {
      keys.add(getWeekRange(task.date).startKey);
    });

    return Array.from(keys)
      .sort((left, right) => right.localeCompare(left))
      .map((key) => {
        const range = getWeekRange(key, language);
        const goals = sortWeeklyGoals(
          state.weeklyGoals.filter((goal) => getWeekRange(goal.startDate).startKey === key),
        );
        const tasks = sortWeekTasks(
          state.dailyTasks.filter(
            (task) => task.date >= range.startKey && task.date <= range.endKey,
          ),
        );

        return {
          key,
          range,
          goals,
          tasks,
          isCurrent: key === currentWeekKey,
          isPast: key < currentWeekKey,
          isFuture: key > currentWeekKey,
        } satisfies WeekSection;
      });
  }, [currentWeek.start, currentWeekKey, language, state.dailyTasks, state.weeklyGoals]);

  const currentSection =
    weekSections.find((section) => section.isCurrent) ??
    ({
      key: currentWeekKey,
      range: currentWeek,
      goals: [],
      tasks: [],
      isCurrent: true,
      isPast: false,
      isFuture: false,
    } satisfies WeekSection);
  const futureSections = weekSections.filter((section) => section.isFuture);
  const pastSections = weekSections.filter((section) => section.isPast);
  const editingWeeklyGoal = state.weeklyGoals.find((goal) => goal.id === editingWeeklyGoalId);
  const activeFormWeekKey =
    editingWeeklyGoal != null
      ? getWeekRange(editingWeeklyGoal.startDate).startKey
      : formTargetWeekKey;

  function toggleWeekSection(key: string) {
    setExpandedWeekKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key],
    );
  }

  function openWeekForm(key: string) {
    setFormTargetWeekKey(key);
    setEditingWeeklyGoalId(null);
    setExpandedWeekKeys((currentKeys) =>
      currentKeys.includes(key) ? currentKeys : [...currentKeys, key],
    );
  }

  function startEditing(goalId: string, weekKey: string) {
    setEditingWeeklyGoalId(goalId);
    setFormTargetWeekKey(null);
    setExpandedWeekKeys((currentKeys) =>
      currentKeys.includes(weekKey) ? currentKeys : [...currentKeys, weekKey],
    );
  }

  function closeWeeklyForm() {
    setFormTargetWeekKey(null);
    setEditingWeeklyGoalId(null);
  }

  function renderSectionContent(section: WeekSection) {
    const showForm = activeFormWeekKey === section.key;

    return (
      <div className="space-y-5">
        {showForm ? (
          <WeeklyGoalForm
            key={editingWeeklyGoal?.id ?? `${section.key}-new-weekly-goal`}
            initialValue={editingWeeklyGoal}
            monthlyGoals={state.monthlyGoals}
            lifeAreas={state.lifeAreas}
            defaultStartDate={section.range.startKey}
            defaultEndDate={section.range.endKey}
            onSubmit={(value) => {
              if (editingWeeklyGoal) {
                updateWeeklyGoal(editingWeeklyGoal.id, value);
              } else {
                addWeeklyGoal(value);
              }
              closeWeeklyForm();
            }}
            onCancel={closeWeeklyForm}
          />
        ) : null}

        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("planning.weekPage.goals")}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {t("planning.weekPage.goalsHint")}
            </p>
          </div>

          {section.goals.length > 0 ? (
            section.goals.map((goal) => {
              const linkedTasks = getTasksForWeeklyGoal(section.tasks, goal.id);

              return (
                <GoalCard
                  key={goal.id}
                  title={goal.title}
                  description={goal.description}
                  lifeArea={goal.lifeArea}
                  status={goal.status}
                  progress={goal.progress}
                  meta={
                    language === "nl"
                      ? `${goal.startDate} t/m ${goal.endDate}`
                      : `${goal.startDate} to ${goal.endDate}`
                  }
                  parentLabel={t("task.month", {
                    value: goal.monthlyGoalId
                      ? (monthlyGoalLookup[goal.monthlyGoalId]?.title ?? t("common.other"))
                      : t("common.other"),
                  })}
                  linkedCount={linkedTasks.length}
                  onEdit={() => startEditing(goal.id, section.key)}
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
              description={getEmptyWeekHint(section, language)}
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
            tasks={section.tasks}
            weeklyGoalLookup={weeklyGoalLookup}
            lifeAreas={state.lifeAreas}
            emptyTitle={t("today.noTasks")}
            emptyDescription={t("planning.dayPage.noTasksHint")}
            showDate
            onToggle={toggleTask}
            onDelete={deleteDailyTask}
            onSave={updateDailyTask}
          />
        </section>
      </div>
    );
  }

  function renderCollapsibleSection(section: WeekSection) {
    const isOpen = expandedWeekKeys.includes(section.key);

    return (
      <section key={section.key} className="app-surface app-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => toggleWeekSection(section.key)}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            {isOpen ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--muted)]" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--muted)]" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {formatWeekHeading(section.range.startKey, language)}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {getWeekSectionSummary(section.goals.length, section.tasks.length, language)}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openWeekForm(section.key)}
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
        title={t("planning.weekPage.title")}
        description={t("planning.weekPage.description")}
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/planning/day" className="app-button-secondary text-sm">
              {t("planning.day.title")}
            </Link>
            <Link href="/planning/month" className="app-button-secondary text-sm">
              {t("planning.month.title")}
            </Link>
          </div>
        }
      />

      <section className="app-surface-strong app-panel-lg space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="app-label">{t("planning.weekPage.current")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
              {formatWeekHeading(currentSection.range.startKey, language)}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => openWeekForm(currentSection.key)}
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
              {t("planning.weekPage.future")}
            </p>
          </div>
          {futureSections.map((section) => renderCollapsibleSection(section))}
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {t("planning.weekPage.previous")}
          </p>
        </div>
        {pastSections.map((section) => renderCollapsibleSection(section))}
      </section>
    </div>
  );
}
