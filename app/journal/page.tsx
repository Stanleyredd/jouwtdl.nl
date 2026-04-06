"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { JournalTemplateForm } from "@/components/journal-template-form";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useJournalVoice } from "@/providers/journal-voice-provider";
import { useAppState } from "@/hooks/use-app-state";
import { translateRuntimeMessage, translateSentiment } from "@/lib/i18n";
import { getWeekRange, shiftDate, toDateKey } from "@/lib/date";
import { getProfileJournalConfig } from "@/services/profile-service";

export default function JournalPage() {
  const { t, language } = useLanguage();
  const { profile, isProfileReady } = useAuth();
  const {
    state,
    isHydrated,
    isJournalReady,
    journalError,
    addDailyTask,
    addWeeklyGoal,
    saveJournalEntry,
    updateJournalSummary,
  } = useAppState();
  const {
    voice,
    activeVoiceTarget,
    voiceInsertHandlerRef,
    startVoiceForField,
    cancelVoice,
    stopVoice,
    resetVoice,
  } = useJournalVoice();
  const [selectedDate, setSelectedDate] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"week" | "month">("week");
  const effectiveSelectedDate =
    selectedDate || (isHydrated ? toDateKey(new Date()) : "");
  const journalConfig = useMemo(
    () => getProfileJournalConfig(profile, language),
    [language, profile],
  );

  const existingEntry = state.journalEntries.find(
    (entry) => entry.date === effectiveSelectedDate,
  );
  const currentWeek = getWeekRange(effectiveSelectedDate || "2000-01-01");
  const relevantWeeklyGoals = state.weeklyGoals.filter(
    (goal) => goal.startDate <= effectiveSelectedDate && goal.endDate >= effectiveSelectedDate,
  );

  const historyEntries = useMemo(() => {
    return state.journalEntries
      .filter((entry) =>
        historyFilter === "week"
          ? effectiveSelectedDate !== "" &&
            entry.date >= currentWeek.startKey &&
            entry.date <= currentWeek.endKey
          : effectiveSelectedDate !== "" &&
            entry.date.startsWith(effectiveSelectedDate.slice(0, 7)),
      )
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [
    currentWeek.endKey,
    currentWeek.startKey,
    effectiveSelectedDate,
    historyFilter,
    state.journalEntries,
  ]);

  if (!isHydrated || !isJournalReady || !isProfileReady || !effectiveSelectedDate) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow={t("journal.eyebrow")}
          title={t("journal.title")}
          description={t("journal.loading")}
        />
        <section className="app-surface-strong app-panel-lg">
          <div className="h-8 w-40 rounded-2xl bg-[color:var(--surface-soft)]" />
          <div className="mt-4 h-20 rounded-[18px] bg-[color:var(--surface-soft)]" />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("journal.eyebrow")}
        title={t("journal.title")}
        description={t("journal.description")}
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

      {existingEntry ? (
        <section className="app-surface app-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {t("journal.savedForDay")}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {existingEntry.aiSummary ||
                  existingEntry.oneSentenceDaySummary ||
                  t("journal.savedNoteFallback")}
              </p>
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              {t("journal.mood", { value: existingEntry.moodScore })}
            </p>
          </div>
        </section>
      ) : null}

      {journalError ? (
        <section className="app-surface app-panel text-sm text-[color:var(--muted)]">
          {translateRuntimeMessage(journalError, language)}
        </section>
      ) : null}

      <div className="space-y-5">
        <JournalTemplateForm
          key={effectiveSelectedDate}
          date={effectiveSelectedDate}
          existingEntry={existingEntry}
          journalConfig={journalConfig}
          lifeAreas={state.lifeAreas}
          weeklyGoals={relevantWeeklyGoals.length > 0 ? relevantWeeklyGoals : state.weeklyGoals}
          monthlyGoals={state.monthlyGoals}
          voice={voice}
          activeVoiceTarget={activeVoiceTarget}
          voiceInsertHandlerRef={voiceInsertHandlerRef}
          onSave={saveJournalEntry}
          onUpdateSummary={updateJournalSummary}
          onCreateTask={(text, weeklyGoalId, date, lifeArea) =>
            addDailyTask({
              weeklyGoalId,
              title: text,
              note: "Created from journal reflection.",
              date,
              priority: "medium",
              lifeArea,
            })
          }
          onCreateWeeklyGoal={(text, monthlyGoalId, lifeArea, startDate, endDate) =>
            addWeeklyGoal({
              monthlyGoalId,
              title: text,
              description: "Created from journal reflection.",
              startDate,
              endDate,
              lifeArea,
              status: "not_started",
            })
          }
          onStartVoice={startVoiceForField}
          onCancelVoice={cancelVoice}
          onStopVoice={stopVoice}
          onResetVoice={resetVoice}
        />

        <section className="app-surface app-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {t("journal.pastEntries")}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {t("journal.pastEntriesHint")}
              </p>
            </div>

            <div className="flex gap-1 rounded-full bg-[color:var(--surface-soft)] p-1">
              {(["week", "month"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setHistoryFilter(filter)}
                  className={`rounded-full px-3 py-1.5 text-sm ${historyFilter === filter ? "bg-[color:var(--surface-overlay-strong)] text-[color:var(--foreground)] shadow-[var(--shadow-chip)]" : "text-[color:var(--muted)]"}`}
                >
                  {t(`history.${filter}` as "history.week" | "history.month")}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {historyEntries.length > 0 ? (
              historyEntries.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  onClick={() => setSelectedDate(entry.date)}
                  className="app-surface-soft block w-full rounded-[18px] px-4 py-4 text-left transition hover:translate-y-[-1px]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {entry.date}
                    </p>
                    <span className="text-xs capitalize text-[color:var(--muted)]">
                      {translateSentiment(entry.sentiment, language)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">
                    {entry.oneSentenceDaySummary || t("journal.savedEntry")}
                  </p>
                </button>
              ))
            ) : (
              <EmptyState
                title={t("journal.noEntries")}
                description={t("journal.noEntriesHint")}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
