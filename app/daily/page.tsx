"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { CarryOverPrompt } from "@/components/carry-over-prompt";
import { DailyTaskForm } from "@/components/planner-forms";
import { PageHeader } from "@/components/page-header";
import { ProgressCard } from "@/components/progress-card";
import { TaskList } from "@/components/task-list";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/hooks/use-language";
import { formatLongDate, shiftDate, toDateKey } from "@/lib/date";
import { getDailyProgress, getTasksForDate } from "@/services/planning-service";

export default function DailyPage() {
  const { t, language } = useLanguage();
  const {
    state,
    isHydrated,
    addDailyTask,
    deleteDailyTask,
    updateDailyTask,
    toggleTask,
    rescheduleTask,
    splitTask,
    convertTaskToWeeklyGoal,
    deprioritizeTask,
  } = useAppState();

  const [selectedDate, setSelectedDate] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const effectiveSelectedDate =
    selectedDate || (isHydrated ? toDateKey(new Date()) : "");

  const tasks = getTasksForDate(state.dailyTasks, effectiveSelectedDate);
  const overdueCarryOver = state.dailyTasks.filter(
    (task) =>
      !task.completed &&
      effectiveSelectedDate !== "" &&
      task.date < effectiveSelectedDate &&
      (task.carryOverCount >= 2 || effectiveSelectedDate === toDateKey(new Date())),
  );
  const weeklyGoalLookup = Object.fromEntries(
    state.weeklyGoals.map((goal) => [goal.id, goal]),
  );

  if (!isHydrated || !effectiveSelectedDate) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("planning.eyebrow")}
          title={t("planning.dayPage.title")}
          description={t("planning.dayPage.loading")}
        />
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="app-surface app-panel h-24" />
          <div className="app-surface app-panel h-24" />
        </section>
        <section className="app-surface app-panel h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("planning.eyebrow")}
        title={t("planning.dayPage.title")}
        description={formatLongDate(effectiveSelectedDate, language)}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedDate((current) =>
                  shiftDate(current || effectiveSelectedDate, -1),
                )
              }
              className="app-icon-button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={effectiveSelectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="app-input w-auto min-w-[160px]"
            />
            <button
              type="button"
              onClick={() =>
                setSelectedDate((current) =>
                  shiftDate(current || effectiveSelectedDate, 1),
                )
              }
              className="app-icon-button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ProgressCard label={t("planning.dayPage.done")} value={getDailyProgress(tasks)} />
        <ProgressCard
          value={Math.min(overdueCarryOver.length * 20, 100)}
          label={t("planning.dayPage.carryOver")}
        />
      </div>

      {showTaskForm ? (
        <DailyTaskForm
          key={`daily-task-${selectedDate}`}
          weeklyGoals={state.weeklyGoals}
          lifeAreas={state.lifeAreas}
          defaultDate={effectiveSelectedDate}
          onSubmit={(value) => {
            addDailyTask(value);
            setShowTaskForm(false);
          }}
          onCancel={() => setShowTaskForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowTaskForm(true)}
          className="app-button-secondary w-fit text-sm"
        >
          <Plus className="h-4 w-4" />
          {t("planning.dayPage.addTask")}
        </button>
      )}

      {overdueCarryOver.length > 0 ? (
        <div className="grid gap-4">
          {overdueCarryOver.slice(0, 2).map((task) => (
            <CarryOverPrompt
              key={task.id}
              task={task}
              onReschedule={() => rescheduleTask(task.id, effectiveSelectedDate)}
              onSplit={() => splitTask(task.id)}
              onConvertToWeeklyGoal={() => convertTaskToWeeklyGoal(task.id)}
              onDeprioritize={() => deprioritizeTask(task.id)}
            />
          ))}
        </div>
      ) : null}

      <TaskList
        tasks={tasks}
        weeklyGoalLookup={weeklyGoalLookup}
        lifeAreas={state.lifeAreas}
        emptyTitle={t("planning.dayPage.noTasks")}
        emptyDescription={t("planning.dayPage.noTasksHint")}
        onToggle={toggleTask}
        onDelete={deleteDailyTask}
        onSave={updateDailyTask}
      />
    </div>
  );
}
