"use client";

import { Activity, BookHeart, CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProgressCard } from "@/components/progress-card";
import { TaskList } from "@/components/task-list";
import { WeeklyStateCard } from "@/components/weekly-state-card";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/hooks/use-language";
import { getMonthRange, getWeekRange, toDateKey } from "@/lib/date";
import {
  generateMonthlyPatternProfile,
  generateWeeklyReview,
  getStreaks,
} from "@/services/analysis-service";
import { getDailyProgress } from "@/services/planning-service";

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const {
    state,
    isHydrated,
    isJournalReady,
    toggleTask,
    deleteDailyTask,
    updateDailyTask,
  } = useAppState();

  if (!isHydrated || !isJournalReady) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow={t("dashboard.eyebrow")}
          title={t("dashboard.title")}
          description={t("dashboard.loading")}
        />
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="app-surface app-panel h-24" />
          <div className="app-surface app-panel h-24" />
          <div className="app-surface app-panel h-24" />
        </section>
      </div>
    );
  }

  const today = toDateKey(new Date());
  const week = getWeekRange(today);
  const month = getMonthRange(today);
  const review = generateWeeklyReview(state, today, language);
  const profile = generateMonthlyPatternProfile(state, today, language);
  const streaks = getStreaks(state, today, language);
  const weekTasks = state.dailyTasks.filter(
    (task) => task.date >= week.startKey && task.date <= week.endKey,
  );
  const monthTasks = state.dailyTasks.filter(
    (task) => task.date >= month.startKey && task.date <= month.endKey,
  );
  const monthEntries = state.journalEntries.filter(
    (entry) => entry.date >= month.startKey && entry.date <= month.endKey,
  );
  const weeklyGoalLookup = Object.fromEntries(
    state.weeklyGoals.map((goal) => [goal.id, goal]),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.title")}
        description={t("dashboard.description")}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <ProgressCard
          label={t("dashboard.thisWeek")}
          value={getDailyProgress(weekTasks)}
          description={
            language === "nl"
              ? `${review.completedTasks.length} van ${weekTasks.length || 0} taken gedaan`
              : `${review.completedTasks.length} of ${weekTasks.length || 0} tasks done`
          }
        />
        <ProgressCard
          label={t("dashboard.thisMonth")}
          value={getDailyProgress(monthTasks)}
          description={
            language === "nl"
              ? `${monthEntries.length} journaldag${monthEntries.length === 1 ? "" : "en"}`
              : `${monthEntries.length} journal day${monthEntries.length === 1 ? "" : "s"}`
          }
        />
        <section className="app-surface app-panel">
          <p className="text-sm font-medium text-[color:var(--foreground)]">
            {t("dashboard.consistency")}
          </p>
          <div className="mt-3 space-y-2 text-sm leading-5 text-[color:var(--muted)]">
            {streaks.supportiveCopy.slice(0, 2).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          <WeeklyStateCard state={review.stateOfWeek} />

          <section className="app-surface app-panel">
            <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
              <CalendarDays className="h-4 w-4 text-[color:var(--accent-strong)]" />
              {t("dashboard.thisMonth")}
            </div>
            <p className="mt-3 text-sm leading-5 text-[color:var(--muted)]">
              {profile.strongestPatterns[0]}
            </p>
            <p className="mt-3 text-sm leading-5 text-[color:var(--muted)]">
              {profile.monthlyAdvice[0]}
            </p>
          </section>

          <section className="app-surface app-panel">
            <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
              <BookHeart className="h-4 w-4 text-[color:var(--accent-strong)]" />
              {t("dashboard.reflection")}
            </div>
            <p className="mt-3 text-sm leading-5 text-[color:var(--muted)]">
              {streaks.supportiveCopy[0]}
            </p>
          </section>
        </div>

        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[color:var(--accent-strong)]" />
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {t("dashboard.finishedThisWeek")}
              </p>
            </div>
            <TaskList
              tasks={review.completedTasks}
              weeklyGoalLookup={weeklyGoalLookup}
              lifeAreas={state.lifeAreas}
              emptyTitle={t("dashboard.nothingFinished")}
              emptyDescription={t("dashboard.nothingFinishedHint")}
              showDate
              onToggle={toggleTask}
              onDelete={deleteDailyTask}
              onSave={updateDailyTask}
            />
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("dashboard.stillOpen")}
            </p>
            {review.incompleteTasks.length > 0 ? (
              <TaskList
                tasks={review.incompleteTasks}
                weeklyGoalLookup={weeklyGoalLookup}
                lifeAreas={state.lifeAreas}
                emptyTitle={t("dashboard.nothingOpen")}
                emptyDescription={t("dashboard.nothingOpenHint")}
                showDate
                onToggle={toggleTask}
                onDelete={deleteDailyTask}
                onSave={updateDailyTask}
              />
            ) : (
              <EmptyState
                title={t("dashboard.nothingOpen")}
                description={t("dashboard.nothingOpenHint")}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
