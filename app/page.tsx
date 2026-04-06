"use client";

import Link from "next/link";
import { ArrowRight, BookHeart, Sparkles } from "lucide-react";

import { ProgressCard } from "@/components/progress-card";
import { TaskList } from "@/components/task-list";
import { TodayFocusCard } from "@/components/today-focus-card";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/hooks/use-language";
import { formatLongDate, toDateKey } from "@/lib/date";
import { generateTodaySuggestion } from "@/services/analysis-service";
import {
  getDailyProgress,
  getTasksForDate,
  getTopTasks,
} from "@/services/planning-service";

export default function HomePage() {
  const { t, language } = useLanguage();
  const {
    state,
    isHydrated,
    isJournalReady,
    setDailyFocus,
    toggleTask,
    deleteDailyTask,
    updateDailyTask,
  } = useAppState();

  if (!isHydrated || !isJournalReady) {
    return <TodayLoadingState />;
  }

  const today = toDateKey(new Date());
  const todayFocus = state.dailyFocuses.find((focus) => focus.date === today);
  const todayTasks = getTasksForDate(state.dailyTasks, today);
  const topTasks = getTopTasks(todayTasks, 3);
  const tasksToShow = topTasks.length > 0 ? topTasks : todayTasks;
  const todaySuggestion = generateTodaySuggestion(state, today, language);
  const todayProgress = getDailyProgress(todayTasks);
  const completedTasks = todayTasks.filter((task) => task.completed).length;
  const weeklyGoalLookup = Object.fromEntries(
    state.weeklyGoals.map((goal) => [goal.id, goal]),
  );

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="app-label">{t("today.eyebrow")}</p>
        <h1 className="text-[clamp(1.8rem,3vw,2.3rem)] font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
          {formatLongDate(today, language)}
        </h1>
      </section>

      <TodayFocusCard
        focus={todayFocus}
        aiSuggestion=""
        onSave={(mainFocus, secondaryFocuses) =>
          setDailyFocus({ date: today, mainFocus, secondaryFocuses })
        }
      />

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {t("today.tasks")}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">{t("today.tasksHint")}</p>
        </div>

        <TaskList
          tasks={tasksToShow}
          weeklyGoalLookup={weeklyGoalLookup}
          lifeAreas={state.lifeAreas}
          emptyTitle={t("today.noTasks")}
          emptyDescription={t("today.noTasksHint")}
          onToggle={toggleTask}
          onDelete={deleteDailyTask}
          onSave={updateDailyTask}
        />

        {todayTasks.length > tasksToShow.length ? (
          <p className="text-sm text-[color:var(--muted)]">
            {t("today.moreInDayView", {
              count: todayTasks.length - tasksToShow.length,
            })}
          </p>
        ) : null}
      </section>

      <ProgressCard
        label={t("today.doneToday")}
        value={todayProgress}
        description={
          language === "nl"
            ? `${completedTasks} van ${todayTasks.length || 0} taken gedaan`
            : `${completedTasks} of ${todayTasks.length || 0} tasks done`
        }
      />

      <section className="app-surface app-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("today.journal")}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{t("today.journalHint")}</p>
          </div>
          <Link href="/journal" className="app-button-primary text-sm">
            <BookHeart className="h-4 w-4" />
            {t("today.openJournal")}
          </Link>
        </div>
      </section>

      <section className="flex items-center gap-2 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-overlay)] px-4 py-3 text-sm text-[color:var(--muted)]">
        <Sparkles className="h-4 w-4 shrink-0 text-[color:var(--accent-strong)]" />
        <span>{todaySuggestion.title}</span>
        <Link
          href="/tips"
          className="ml-auto inline-flex items-center gap-1 text-[color:var(--foreground)]"
        >
          {t("today.tips")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}

function TodayLoadingState() {
  const { t } = useLanguage();

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div>
          <p className="app-label">{t("today.eyebrow")}</p>
          <h1 className="mt-2 text-[clamp(1.8rem,3vw,2.3rem)] font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
            {t("today.titleFallback")}
          </h1>
        </div>
      </section>

      <section className="app-surface-strong app-panel-lg">
        <p className="app-label">{t("focus.label")}</p>
        <div className="mt-4 h-10 w-2/3 rounded-2xl bg-[color:var(--surface-soft)]" />
      </section>

      <section className="app-surface app-panel">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          {t("today.tasks")}
        </p>
        <div className="mt-4 space-y-3">
          <div className="h-14 rounded-[18px] bg-[color:var(--surface-soft)]" />
          <div className="h-14 rounded-[18px] bg-[color:var(--surface-soft)]" />
          <div className="h-14 rounded-[18px] bg-[color:var(--surface-soft)]" />
        </div>
      </section>

      <section className="app-surface app-panel">
        <div className="h-1.5 rounded-full bg-[color:var(--progress-track)]" />
      </section>

      <section className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-overlay)] px-4 py-3 text-sm text-[color:var(--muted)]">
        {t("today.loadingTip")}
      </section>
    </div>
  );
}
