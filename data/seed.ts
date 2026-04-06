import { addDays } from "date-fns";

import { defaultLifeAreas } from "@/data/life-areas";
import { createEmptyJournalSections, normalizeJournalSections } from "@/data/journal-template";
import { getWeekRange, toDateKey } from "@/lib/date";
import { createId } from "@/lib/utils";
import { recalculateAppState } from "@/services/planning-service";
import type { AppState, JournalEntry, TomorrowSetup } from "@/types";

export function createEmptyState(): AppState {
  return {
    version: 1,
    initializedAt: "",
    lifeAreas: [...defaultLifeAreas],
    monthlyGoals: [],
    weeklyGoals: [],
    dailyTasks: [],
    dailyFocuses: [],
    journalEntries: [],
  };
}

function createJournalEntry(
  date: string,
  values: Partial<Record<string, Partial<Record<string, string>>>>,
  meta: Pick<
    JournalEntry,
    | "sentiment"
    | "moodScore"
    | "powerLevel"
    | "lifeAreasMentioned"
    | "blockersDetected"
    | "oneSentenceDaySummary"
  >,
  tomorrowSetup: TomorrowSetup,
): JournalEntry {
  const sections = createEmptyJournalSections();

  Object.entries(values).forEach(([sectionId, fields]) => {
    const sanitizedFields = Object.fromEntries(
      Object.entries(fields ?? {}).filter(([, value]) => typeof value === "string"),
    ) as Record<string, string>;

    sections[sectionId] = {
      ...sections[sectionId],
      ...sanitizedFields,
    };
  });

  const timestamp = new Date().toISOString();

  return {
    id: createId("journal"),
    date,
    sections: normalizeJournalSections(sections),
    rawTranscript: "",
    editedTranscript: "",
    aiSummary: "",
    aiSummaryError: null,
    tomorrowSetup,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...meta,
  };
}

export function createSeedState(referenceDate: Date): AppState {
  const today = toDateKey(referenceDate);
  const yesterday = toDateKey(addDays(referenceDate, -1));
  const twoDaysAgo = toDateKey(addDays(referenceDate, -2));
  const tomorrow = toDateKey(addDays(referenceDate, 1));
  const week = getWeekRange(referenceDate);
  const timestamp = new Date().toISOString();

  const monthlyGoalTradingId = createId("monthly-goal");
  const monthlyGoalHealthId = createId("monthly-goal");
  const monthlyGoalBusinessId = createId("monthly-goal");

  const weeklyGoalTradingId = createId("weekly-goal");
  const weeklyGoalHealthId = createId("weekly-goal");
  const weeklyGoalBusinessId = createId("weekly-goal");

  const journalEntries = [
    createJournalEntry(
      yesterday,
      {
        evening_thoughts: {
          general_thoughts:
            "I expected a quieter BTC session, but the market was more reactive than I planned for.",
          facts:
            "Price reclaimed the 4H band, I skipped one impulsive trade, and admin work slipped again.",
          expectations_for_tomorrow:
            "Tomorrow I want to focus on patience before the open and a smaller non-trading list.",
        },
        end_of_day: {
          day_reflection:
            "The day was steady overall, though my energy dipped once I started juggling too much.",
          task_execution_reflection:
            "I completed the important planning work but postponed one admin task for the third time.",
          productivity_reflection:
            "Productive enough, but follow-through got softer when my list widened.",
          gratitude_or_key_takeaways:
            "I am grateful that I stayed calm around the first BTC move and did not chase.",
        },
        power_update: {
          power_level: "6",
          why_this_power_level:
            "I felt fairly clear in the morning, but lower energy showed up after lunch.",
          reset_or_next_step:
            "Start with one business task and keep the admin list narrow.",
        },
        one_sentence_summary: {
          one_sentence_day_summary:
            "I moved forward by staying patient, but too many side tasks made the finish messy.",
        },
      },
      {
        sentiment: "steady",
        moodScore: 6,
        powerLevel: 6,
        lifeAreasMentioned: ["trading", "business", "admin"],
        blockersDetected: ["overplanning", "low energy"],
        oneSentenceDaySummary:
          "I moved forward by staying patient, but too many side tasks made the finish messy.",
      },
      {
        mainFocus: "Keep tomorrow simple and calm before the market open.",
        topTasks: [
          "Review BTC 4H structure before the open",
          "Ship the dashboard cleanup for business",
          "Close the lingering admin task",
        ],
        watchOutFor: "Trying to do too much once momentum appears.",
        intention: "Stay narrow enough that the day still feels spacious.",
      },
    ),
    createJournalEntry(
      twoDaysAgo,
      {
        end_of_day: {
          day_reflection:
            "I was more scattered than I looked on paper and delayed one uncomfortable finance task again.",
          productivity_reflection:
            "Energy was low, and I noticed procrastination whenever the task felt vague.",
        },
        power_update: {
          power_level: "4",
          why_this_power_level:
            "Low energy and vague priorities made the day feel heavier than it needed to.",
          reset_or_next_step:
            "Make tomorrow's first task more specific.",
        },
        one_sentence_summary: {
          one_sentence_day_summary:
            "A vague plan plus lower energy made the day feel wider than it really was.",
        },
      },
      {
        sentiment: "low",
        moodScore: 4,
        powerLevel: 4,
        lifeAreasMentioned: ["finances", "admin"],
        blockersDetected: ["procrastination", "low energy", "unclear priorities"],
        oneSentenceDaySummary:
          "A vague plan plus lower energy made the day feel wider than it really was.",
      },
      {
        mainFocus: "Clarify the first task before adding more.",
        topTasks: ["Define the finance action", "Train", "Check market structure"],
        watchOutFor: "Avoiding the vague task until the afternoon.",
        intention: "Win the day by making the first step concrete.",
      },
    ),
  ];

  return recalculateAppState({
    ...createEmptyState(),
    initializedAt: timestamp,
    lifeAreas: defaultLifeAreas,
    monthlyGoals: [
      {
        id: monthlyGoalTradingId,
        title: "Keep trading execution calm and rule-based",
        description:
          "Reduce emotional trades and protect patience around the BTC 4H structure.",
        month: referenceDate.getMonth() + 1,
        year: referenceDate.getFullYear(),
        lifeArea: "trading",
        status: "in_progress",
        progress: 0,
        dueDate: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: monthlyGoalHealthId,
        title: "Rebuild a steadier recovery rhythm",
        description:
          "Use training, sleep, and lighter planning to support more stable energy.",
        month: referenceDate.getMonth() + 1,
        year: referenceDate.getFullYear(),
        lifeArea: "health",
        status: "in_progress",
        progress: 0,
        dueDate: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: monthlyGoalBusinessId,
        title: "Ship one meaningful business improvement each week",
        description:
          "Focus on fewer upgrades that remove friction from the day-to-day workflow.",
        month: referenceDate.getMonth() + 1,
        year: referenceDate.getFullYear(),
        lifeArea: "business",
        status: "in_progress",
        progress: 0,
        dueDate: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    weeklyGoals: [
      {
        id: weeklyGoalTradingId,
        monthlyGoalId: monthlyGoalTradingId,
        title: "Review BTC structure before any discretionary trade",
        description:
          "Anchor every trading decision in the 4H picture before reacting to intraday movement.",
        weekNumber: week.weekNumber,
        startDate: week.startKey,
        endDate: week.endKey,
        lifeArea: "trading",
        status: "in_progress",
        progress: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: weeklyGoalHealthId,
        monthlyGoalId: monthlyGoalHealthId,
        title: "Protect energy with training and lighter evenings",
        description:
          "Keep the first part of the day clear and avoid carrying too much admin work late.",
        weekNumber: week.weekNumber,
        startDate: week.startKey,
        endDate: week.endKey,
        lifeArea: "health",
        status: "in_progress",
        progress: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: weeklyGoalBusinessId,
        monthlyGoalId: monthlyGoalBusinessId,
        title: "Finish the app dashboard cleanup",
        description:
          "Tighten the current dashboard flow so the product feels quieter and more useful.",
        weekNumber: week.weekNumber,
        startDate: week.startKey,
        endDate: week.endKey,
        lifeArea: "business",
        status: "in_progress",
        progress: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    dailyTasks: [
      {
        id: createId("task"),
        weeklyGoalId: weeklyGoalTradingId,
        title: "Review Bitcoin 4H chart before the open",
        note: "Check price position against the 15 and 100 EMA bands.",
        date: today,
        priority: "high",
        lifeArea: "trading",
        completed: false,
        carryOverCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: createId("task"),
        weeklyGoalId: weeklyGoalBusinessId,
        title: "Ship the dashboard empty-state polish",
        note: "Finish copy and spacing so the experience feels calmer.",
        date: today,
        priority: "high",
        lifeArea: "business",
        completed: false,
        carryOverCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: createId("task"),
        weeklyGoalId: weeklyGoalHealthId,
        title: "Go for a recovery walk after lunch",
        note: "Use it to reset rather than squeeze in more planning.",
        date: today,
        priority: "medium",
        lifeArea: "health",
        completed: true,
        carryOverCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: createId("task"),
        weeklyGoalId: weeklyGoalBusinessId,
        title: "Close the postponed admin follow-up",
        note: "It has moved three times already. Keep it short.",
        date: yesterday,
        priority: "medium",
        lifeArea: "admin",
        completed: false,
        carryOverCount: 2,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: createId("task"),
        weeklyGoalId: weeklyGoalTradingId,
        title: "Log post-trade notes before checking social feeds",
        note: "Protect reflection from market noise.",
        date: tomorrow,
        priority: "medium",
        lifeArea: "trading",
        completed: false,
        carryOverCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: createId("task"),
        weeklyGoalId: weeklyGoalHealthId,
        title: "Set a lighter evening routine",
        note: "Keep the final hour off loading screens if possible.",
        date: tomorrow,
        priority: "low",
        lifeArea: "health",
        completed: false,
        carryOverCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    dailyFocuses: [
      {
        id: createId("focus"),
        date: today,
        mainFocus: "Keep the day narrow enough that execution stays calm.",
        secondaryFocuses: [
          "Finish one business improvement before widening the list.",
          "Notice emotional drift before reacting to market movement.",
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: createId("focus"),
        date: tomorrow,
        mainFocus: "Protect the first hour and start from structure, not urgency.",
        secondaryFocuses: [
          "Clear the oldest postponed task.",
          "Keep energy steady with a lighter evening.",
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    journalEntries,
  });
}
