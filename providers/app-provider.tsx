"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createEmptyState } from "@/data/seed";
import { getWeekRange, toDateKey } from "@/lib/date";
import { createId, toTitleCase } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { analyzeJournalEntryContent } from "@/services/analysis-service";
import {
  createDailyTask as createDailyTaskRequest,
  deleteDailyTaskById,
  listDailyTasks,
  updateDailyTaskById,
} from "@/services/daily-task-api-service";
import {
  finalizeJournalEntryByDate,
  listJournalEntries,
  saveJournalEntry as saveJournalEntryRequest,
  saveJournalSectionByDate,
  saveTomorrowSetupByDate,
  updateJournalSummaryByDate,
} from "@/services/journal-entry-api-service";
import {
  createMonthlyGoal as createMonthlyGoalRequest,
  deleteMonthlyGoalById,
  listMonthlyGoals,
  updateMonthlyGoalById,
} from "@/services/monthly-goal-api-service";
import {
  savePlanningStateForUser,
} from "@/services/planning-persistence-service";
import {
  recalculateAppState,
  resolveDailyTaskMonthlyGoalId,
} from "@/services/planning-service";
import {
  hasCompletedJournalEntriesDatabaseMigration,
  hasCompletedDailyTasksDatabaseMigration,
  hasCompletedMonthlyGoalsDatabaseMigration,
  hasCompletedWeeklyGoalsDatabaseMigration,
  loadAppState,
  markJournalEntriesDatabaseMigrationComplete,
  markDailyTasksDatabaseMigrationComplete,
  markMonthlyGoalsDatabaseMigrationComplete,
  markWeeklyGoalsDatabaseMigrationComplete,
  saveAppState,
} from "@/services/storage-service";
import {
  createWeeklyGoal as createWeeklyGoalRequest,
  deleteWeeklyGoalById,
  listWeeklyGoals,
  updateWeeklyGoalById,
} from "@/services/weekly-goal-api-service";
import type {
  AppState,
  DailyFocus,
  DailyFocusInput,
  DailyTask,
  DailyTaskInput,
  JournalEntry,
  JournalEntryInput,
  MonthlyGoal,
  MonthlyGoalInput,
  TomorrowSetup,
  WeeklyGoal,
  WeeklyGoalInput,
} from "@/types";

interface AppContextValue {
  state: AppState;
  isHydrated: boolean;
  isPlanningReady: boolean;
  planningStatus: "idle" | "loading" | "ready" | "error";
  isJournalReady: boolean;
  journalStatus: "idle" | "loading" | "ready" | "error";
  storageError: string | null;
  planningError: string | null;
  journalError: string | null;
  addMonthlyGoal: (input: MonthlyGoalInput) => void;
  updateMonthlyGoal: (id: string, updates: Partial<MonthlyGoal>) => void;
  deleteMonthlyGoal: (id: string) => void;
  addWeeklyGoal: (input: WeeklyGoalInput) => void;
  updateWeeklyGoal: (id: string, updates: Partial<WeeklyGoal>) => void;
  deleteWeeklyGoal: (id: string) => void;
  addDailyTask: (input: DailyTaskInput) => void;
  updateDailyTask: (id: string, updates: Partial<DailyTask>) => void;
  deleteDailyTask: (id: string) => void;
  toggleTask: (id: string) => void;
  rescheduleTask: (id: string, newDate: string) => void;
  splitTask: (id: string) => void;
  convertTaskToWeeklyGoal: (id: string) => void;
  deprioritizeTask: (id: string) => void;
  setDailyFocus: (input: DailyFocusInput) => void;
  saveJournalEntry: (input: JournalEntryInput) => Promise<JournalEntry>;
  saveJournalSection: (
    date: string,
    input: {
      sectionKey: string;
      content: string;
      rawTranscript: string;
      editedTranscript: string;
    },
  ) => Promise<JournalEntry>;
  saveTomorrowSetup: (
    date: string,
    input: {
      tomorrowSetup: TomorrowSetup;
      rawTranscript: string;
      editedTranscript: string;
    },
  ) => Promise<JournalEntry>;
  finalizeJournalEntry: (date: string) => Promise<JournalEntry>;
  updateJournalSummary: (
    date: string,
    updates: {
      aiSummary?: string;
      aiSummaryError?: string | null;
    },
  ) => Promise<JournalEntry | null>;
  addLifeArea: (name: string) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

function buildMonthlyGoal(input: MonthlyGoalInput): MonthlyGoal {
  const timestamp = new Date().toISOString();
  return {
    id: createId("monthly-goal"),
    title: input.title,
    description: input.description,
    month: input.month,
    year: input.year,
    lifeArea: input.lifeArea,
    status: input.status ?? "not_started",
    progressMode: input.progressMode ?? "linked_items",
    progress: 0,
    dueDate: input.dueDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildWeeklyGoal(input: WeeklyGoalInput): WeeklyGoal {
  const timestamp = new Date().toISOString();
  return {
    id: createId("weekly-goal"),
    monthlyGoalId: input.monthlyGoalId ?? null,
    title: input.title,
    description: input.description,
    weekNumber: getWeekRange(input.startDate).weekNumber,
    startDate: input.startDate,
    endDate: input.endDate,
    lifeArea: input.lifeArea,
    status: input.status ?? "not_started",
    progressMode: input.progressMode ?? "linked_items",
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildDailyTask(input: DailyTaskInput): DailyTask {
  const timestamp = new Date().toISOString();
  return {
    id: createId("task"),
    weeklyGoalId: input.weeklyGoalId ?? null,
    monthlyGoalId: input.monthlyGoalId ?? null,
    title: input.title,
    note: input.note,
    date: input.date,
    priority: input.priority,
    lifeArea: input.lifeArea,
    completed: false,
    carryOverCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildDailyFocus(input: DailyFocusInput): DailyFocus {
  const timestamp = new Date().toISOString();
  return {
    id: createId("focus"),
    date: input.date,
    mainFocus: input.mainFocus,
    secondaryFocuses: input.secondaryFocuses,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function upsertJournalEntry(entries: JournalEntry[], nextEntry: JournalEntry) {
  const nextEntries = entries.some((entry) => entry.date === nextEntry.date)
    ? entries.map((entry) => (entry.date === nextEntry.date ? nextEntry : entry))
    : [...entries, nextEntry];

  return nextEntries.sort((left, right) => left.date.localeCompare(right.date));
}

function buildLocalJournalEntry(
  currentState: AppState,
  input: JournalEntryInput,
  existingEntry?: JournalEntry,
): JournalEntry {
  const timestamp = new Date().toISOString();
  const analysis = analyzeJournalEntryContent(input, currentState.lifeAreas);

  return {
    id: existingEntry?.id ?? createId("journal"),
    date: input.date,
    sections: input.sections,
    rawTranscript: input.rawTranscript,
    editedTranscript: input.editedTranscript,
    aiSummary: existingEntry?.aiSummary ?? "",
    aiSummaryError: existingEntry?.aiSummaryError ?? null,
    aiSummaryUpdatedAt: existingEntry?.aiSummaryUpdatedAt,
    finalizedAt: existingEntry?.finalizedAt ?? null,
    tomorrowSetup: input.tomorrowSetup,
    sentiment: analysis.sentiment,
    moodScore: analysis.moodScore,
    powerLevel: analysis.powerLevel,
    lifeAreasMentioned: analysis.lifeAreasMentioned,
    blockersDetected: analysis.blockersDetected,
    oneSentenceDaySummary: analysis.oneSentenceDaySummary,
    createdAt: existingEntry?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.some((item) => item.id === nextItem.id)
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [...items, nextItem];
}

function applyWeeklyGoalUpdates(
  goal: WeeklyGoal,
  updates: Partial<WeeklyGoal>,
): WeeklyGoal {
  const startDate = updates.startDate ?? goal.startDate;

  return {
    ...goal,
    ...updates,
    weekNumber: getWeekRange(startDate).weekNumber,
    updatedAt: new Date().toISOString(),
  };
}

function applyDailyTaskUpdates(
  task: DailyTask,
  updates: Partial<DailyTask>,
): DailyTask {
  return {
    ...task,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeDailyTaskGoalLinks(
  task: DailyTask,
  monthlyGoals: MonthlyGoal[],
  weeklyGoals: WeeklyGoal[],
): DailyTask {
  return {
    ...task,
    monthlyGoalId: resolveDailyTaskMonthlyGoalId(monthlyGoals, weeklyGoals, task),
  };
}

function toMonthlyGoalApiPayload(goal: MonthlyGoal) {
  return {
    title: goal.title,
    description: goal.description,
    month: goal.month,
    year: goal.year,
    lifeArea: goal.lifeArea,
    status: goal.status,
    progressMode: goal.progressMode,
    progress: goal.progress,
    dueDate: goal.dueDate,
  };
}

function toWeeklyGoalApiPayload(goal: WeeklyGoal) {
  return {
    monthlyGoalId: goal.monthlyGoalId,
    title: goal.title,
    description: goal.description,
    startDate: goal.startDate,
    endDate: goal.endDate,
    lifeArea: goal.lifeArea,
    status: goal.status,
    progressMode: goal.progressMode,
    progress: goal.progress,
  };
}

function toDailyTaskApiPayload(task: DailyTask) {
  return {
    weeklyGoalId: task.weeklyGoalId,
    monthlyGoalId: task.monthlyGoalId,
    title: task.title,
    note: task.note,
    date: task.date,
    priority: task.priority,
    lifeArea: task.lifeArea,
    completed: task.completed,
    carryOverCount: task.carryOverCount,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, supabase, isReady: isAuthReady, isConfigured } = useAuth();
  const { language } = useLanguage();
  const [state, setState] = useState<AppState>(() => createEmptyState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [planningStatus, setPlanningStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [journalStatus, setJournalStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [journalError, setJournalError] = useState<string | null>(null);
  const storageScope = isConfigured && user ? `user:${user.id}` : "guest";
  const shouldSeedLocalState = !isConfigured || !user;
  const journalRequestIdRef = useRef(0);
  const planningRequestIdRef = useRef(0);
  const planningSyncTimeoutRef = useRef<number | null>(null);
  const hasPlanningBaselineRef = useRef(false);
  const latestStateRef = useRef(state);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (isConfigured && !isAuthReady) {
      return;
    }

    setIsHydrated(false);
    setHydratedScope(null);
    setPlanningStatus("idle");
    setPlanningError(null);
    hasPlanningBaselineRef.current = !Boolean(isConfigured && user && supabase);

    const timeoutId = window.setTimeout(() => {
      const loaded = loadAppState({
        scope: storageScope,
        useSeedData: shouldSeedLocalState,
      });

      setState(recalculateAppState(loaded.state));
      setStorageError(loaded.error);
      setHydratedScope(storageScope);
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isAuthReady, isConfigured, shouldSeedLocalState, storageScope, supabase, user]);

  useEffect(() => {
    if (!isHydrated || hydratedScope !== storageScope) {
      return;
    }

    const saveError = saveAppState(state, {
      includeJournalEntries: !(isConfigured && user && supabase),
      scope: storageScope,
    });
    setStorageError(saveError);
  }, [hydratedScope, isConfigured, isHydrated, state, storageScope, supabase, user]);

  useEffect(() => {
    if (!isHydrated || hydratedScope !== storageScope || !isAuthReady) {
      return;
    }

    if (!isConfigured) {
      setPlanningError(null);
      setPlanningStatus("ready");
      hasPlanningBaselineRef.current = true;
      return;
    }

    planningRequestIdRef.current += 1;
    const requestId = planningRequestIdRef.current;

    if (!user) {
      setPlanningError(null);
      setPlanningStatus("ready");
      hasPlanningBaselineRef.current = true;
      return;
    }

    setPlanningStatus("loading");
    setPlanningError(null);
    hasPlanningBaselineRef.current = false;

    void Promise.all([listMonthlyGoals(), listWeeklyGoals(), listDailyTasks()])
      .then(async ([remoteMonthlyGoals, remoteWeeklyGoals, remoteDailyTasks]) => {
        if (planningRequestIdRef.current !== requestId) {
          return;
        }

        let canonicalMonthlyGoals = remoteMonthlyGoals;
        let canonicalWeeklyGoals = remoteWeeklyGoals;
        let canonicalDailyTasks = remoteDailyTasks;

        if (!hasCompletedMonthlyGoalsDatabaseMigration(storageScope)) {
          const localMonthlyGoals = latestStateRef.current.monthlyGoals;
          const existingGoalIds = new Set(remoteMonthlyGoals.map((goal) => goal.id));
          const missingLocalGoals = localMonthlyGoals.filter(
            (goal) => !existingGoalIds.has(goal.id),
          );

          if (missingLocalGoals.length > 0) {
            for (const localGoal of missingLocalGoals) {
              await createMonthlyGoalRequest({
                id: localGoal.id,
                ...toMonthlyGoalApiPayload(localGoal),
                createdAt: localGoal.createdAt,
              });
            }

            if (planningRequestIdRef.current !== requestId) {
              return;
            }

            canonicalMonthlyGoals = await listMonthlyGoals();
          }

          markMonthlyGoalsDatabaseMigrationComplete(storageScope);
        }

        if (!hasCompletedWeeklyGoalsDatabaseMigration(storageScope)) {
          const localWeeklyGoals = latestStateRef.current.weeklyGoals;
          const existingWeeklyGoalIds = new Set(
            canonicalWeeklyGoals.map((goal) => goal.id),
          );
          const availableMonthlyGoalIds = new Set(
            canonicalMonthlyGoals.map((goal) => goal.id),
          );
          const missingLocalWeeklyGoals = localWeeklyGoals.filter(
            (goal) => !existingWeeklyGoalIds.has(goal.id),
          );

          if (missingLocalWeeklyGoals.length > 0) {
            for (const localGoal of missingLocalWeeklyGoals) {
              await createWeeklyGoalRequest({
                id: localGoal.id,
                monthlyGoalId:
                  localGoal.monthlyGoalId &&
                  availableMonthlyGoalIds.has(localGoal.monthlyGoalId)
                    ? localGoal.monthlyGoalId
                    : null,
                title: localGoal.title,
                description: localGoal.description,
                startDate: localGoal.startDate,
                endDate: localGoal.endDate,
                lifeArea: localGoal.lifeArea,
                status: localGoal.status,
                progressMode: localGoal.progressMode ?? "linked_items",
                progress: localGoal.progress,
                createdAt: localGoal.createdAt,
              });
            }

            if (planningRequestIdRef.current !== requestId) {
              return;
            }

            canonicalWeeklyGoals = await listWeeklyGoals();
          }

          markWeeklyGoalsDatabaseMigrationComplete(storageScope);
        }

        if (!hasCompletedDailyTasksDatabaseMigration(storageScope)) {
          const localDailyTasks = latestStateRef.current.dailyTasks;
          const existingDailyTaskIds = new Set(canonicalDailyTasks.map((task) => task.id));
          const availableWeeklyGoalIds = new Set(
            canonicalWeeklyGoals.map((goal) => goal.id),
          );
          const missingLocalDailyTasks = localDailyTasks.filter(
            (task) => !existingDailyTaskIds.has(task.id),
          );

          if (missingLocalDailyTasks.length > 0) {
            for (const localTask of missingLocalDailyTasks) {
              await createDailyTaskRequest({
                id: localTask.id,
                weeklyGoalId:
                  localTask.weeklyGoalId &&
                  availableWeeklyGoalIds.has(localTask.weeklyGoalId)
                    ? localTask.weeklyGoalId
                    : null,
                monthlyGoalId: normalizeDailyTaskGoalLinks(
                  localTask,
                  canonicalMonthlyGoals,
                  canonicalWeeklyGoals,
                ).monthlyGoalId,
                title: localTask.title,
                note: localTask.note,
                date: localTask.date,
                priority: localTask.priority,
                lifeArea: localTask.lifeArea,
                completed: localTask.completed,
                carryOverCount: localTask.carryOverCount,
                createdAt: localTask.createdAt,
              });
            }

            if (planningRequestIdRef.current !== requestId) {
              return;
            }

            canonicalDailyTasks = await listDailyTasks();
          }

          markDailyTasksDatabaseMigrationComplete(storageScope);
        }

        const nextState = recalculateAppState({
          ...latestStateRef.current,
          monthlyGoals: canonicalMonthlyGoals,
          weeklyGoals: canonicalWeeklyGoals,
          dailyTasks: canonicalDailyTasks,
        });

        latestStateRef.current = nextState;
        setState(nextState);
        setPlanningStatus("ready");
        setPlanningError(null);
        hasPlanningBaselineRef.current = true;
      })
      .catch((caughtError) => {
        if (planningRequestIdRef.current !== requestId) {
          return;
        }

        setPlanningStatus("error");
        setPlanningError(
          caughtError instanceof Error
            ? caughtError.message
            : "Planning data could not be loaded right now.",
        );
        hasPlanningBaselineRef.current = true;
      });
  }, [hydratedScope, isAuthReady, isConfigured, isHydrated, storageScope, user]);

  useEffect(() => {
    if (planningSyncTimeoutRef.current) {
      window.clearTimeout(planningSyncTimeoutRef.current);
      planningSyncTimeoutRef.current = null;
    }

    if (!isHydrated || hydratedScope !== storageScope) {
      return;
    }

    if (!(isConfigured && user && supabase)) {
      return;
    }

    if (!hasPlanningBaselineRef.current || planningStatus === "loading") {
      return;
    }

    planningSyncTimeoutRef.current = window.setTimeout(() => {
      void savePlanningStateForUser({
        client: supabase,
        userId: user.id,
        state: {
          monthlyGoals: state.monthlyGoals,
          weeklyGoals: state.weeklyGoals,
          dailyTasks: state.dailyTasks,
          dailyFocuses: state.dailyFocuses,
        },
      })
        .then(() => {
          setPlanningError(null);
        })
        .catch((caughtError) => {
          setPlanningError(
            caughtError instanceof Error
              ? caughtError.message
              : "Planning data could not be saved right now.",
          );
        });
    }, 160);

    return () => {
      if (planningSyncTimeoutRef.current) {
        window.clearTimeout(planningSyncTimeoutRef.current);
        planningSyncTimeoutRef.current = null;
      }
    };
  }, [
    hydratedScope,
    isConfigured,
    isHydrated,
    planningStatus,
    state.dailyFocuses,
    state.dailyTasks,
    state.monthlyGoals,
    state.weeklyGoals,
    storageScope,
    supabase,
    user,
  ]);

  useEffect(() => {
    if (!isHydrated || hydratedScope !== storageScope || !isAuthReady) {
      return;
    }

    if (!isConfigured) {
      setJournalError(null);
      setJournalStatus("ready");
      return;
    }

    journalRequestIdRef.current += 1;
    const requestId = journalRequestIdRef.current;

    if (!user) {
      setJournalError(null);
      setJournalStatus("ready");
      return;
    }

    setJournalStatus("loading");
    setJournalError(null);

    void listJournalEntries(state.lifeAreas)
      .then(async (remoteEntries) => {
        if (journalRequestIdRef.current !== requestId) {
          return;
        }

        let canonicalEntries = remoteEntries;

        if (!hasCompletedJournalEntriesDatabaseMigration(storageScope)) {
          const localEntries = latestStateRef.current.journalEntries;
          const existingDates = new Set(remoteEntries.map((entry) => entry.date));
          const missingLocalEntries = localEntries.filter(
            (entry) => !existingDates.has(entry.date),
          );

          if (missingLocalEntries.length > 0) {
            for (const localEntry of missingLocalEntries) {
              await saveJournalEntryRequest({
                date: localEntry.date,
                sections: localEntry.sections,
                rawTranscript: localEntry.rawTranscript,
                editedTranscript: localEntry.editedTranscript,
                tomorrowSetup: localEntry.tomorrowSetup,
                language,
                lifeAreas: latestStateRef.current.lifeAreas,
                createdAt: localEntry.createdAt,
                aiSummary: localEntry.aiSummary,
                aiSummaryError: localEntry.aiSummaryError,
                aiSummaryUpdatedAt: localEntry.aiSummaryUpdatedAt,
                finalizedAt:
                  localEntry.finalizedAt ??
                  (localEntry.aiSummary.trim()
                    ? localEntry.aiSummaryUpdatedAt ?? localEntry.updatedAt
                    : undefined),
              });
            }

            if (journalRequestIdRef.current !== requestId) {
              return;
            }

            canonicalEntries = await listJournalEntries(state.lifeAreas);
          }

          markJournalEntriesDatabaseMigrationComplete(storageScope);
        }

        setState((currentState) =>
          recalculateAppState({
            ...currentState,
            journalEntries: canonicalEntries,
          }),
        );
        setJournalStatus("ready");
        setJournalError(null);
      })
      .catch((caughtError) => {
        if (journalRequestIdRef.current !== requestId) {
          return;
        }

        setJournalStatus("error");
        setJournalError(
          caughtError instanceof Error
            ? caughtError.message
            : "Journal entries could not be loaded right now.",
        );
      });
  }, [
    hydratedScope,
    isAuthReady,
    isConfigured,
    isHydrated,
    language,
    state.lifeAreas,
    storageScope,
    user,
  ]);

  const commit = useCallback((updater: (currentState: AppState) => AppState) => {
    const nextState = recalculateAppState(updater(latestStateRef.current));
    latestStateRef.current = nextState;
    setState(nextState);
    return nextState;
  }, []);

  const value = useMemo<AppContextValue>(() => {
    return {
      state,
      isHydrated,
      isPlanningReady: planningStatus !== "loading",
      planningStatus,
      isJournalReady: journalStatus !== "loading",
      journalStatus,
      storageError,
      planningError,
      journalError,
      addMonthlyGoal(input) {
        if (!user) {
          commit((currentState) => ({
            ...currentState,
            monthlyGoals: [...currentState.monthlyGoals, buildMonthlyGoal(input)],
          }));
          return;
        }

        const optimisticGoal = buildMonthlyGoal(input);
        const optimisticState = commit((currentState) => ({
          ...currentState,
          monthlyGoals: [...currentState.monthlyGoals, optimisticGoal],
        }));
        const normalizedGoal =
          optimisticState.monthlyGoals.find((goal) => goal.id === optimisticGoal.id) ??
          optimisticGoal;

        void createMonthlyGoalRequest({
          id: normalizedGoal.id,
          ...toMonthlyGoalApiPayload(normalizedGoal),
          createdAt: optimisticGoal.createdAt,
        })
          .then((savedGoal) => {
            commit((currentState) => ({
              ...currentState,
              monthlyGoals: currentState.monthlyGoals.some(
                (goal) => goal.id === savedGoal.id,
              )
                ? currentState.monthlyGoals.map((goal) =>
                    goal.id === savedGoal.id ? savedGoal : goal,
                  )
                : [...currentState.monthlyGoals, savedGoal],
            }));
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              monthlyGoals: currentState.monthlyGoals.filter(
                (goal) => goal.id !== optimisticGoal.id,
              ),
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Monthly goal could not be saved right now.",
            );
          });
      },
      updateMonthlyGoal(id, updates) {
        const previousGoal = latestStateRef.current.monthlyGoals.find(
          (goal) => goal.id === id,
        );

        if (!previousGoal) {
          return;
        }

        if (!user) {
          commit((currentState) => ({
            ...currentState,
            monthlyGoals: currentState.monthlyGoals.map((goal) =>
              goal.id === id
                ? { ...goal, ...updates, updatedAt: new Date().toISOString() }
                : goal,
            ),
          }));
          return;
        }

        const optimisticState = commit((currentState) => ({
          ...currentState,
          monthlyGoals: currentState.monthlyGoals.map((goal) =>
            goal.id === id
              ? { ...goal, ...updates, updatedAt: new Date().toISOString() }
              : goal,
          ),
        }));
        const normalizedGoal = optimisticState.monthlyGoals.find(
          (goal) => goal.id === id,
        );

        if (!normalizedGoal) {
          return;
        }

        void updateMonthlyGoalById(id, toMonthlyGoalApiPayload(normalizedGoal))
          .then((savedGoal) => {
            commit((currentState) => ({
              ...currentState,
              monthlyGoals: currentState.monthlyGoals.map((goal) =>
                goal.id === savedGoal.id ? savedGoal : goal,
              ),
            }));
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              monthlyGoals: currentState.monthlyGoals.map((goal) =>
                goal.id === id ? previousGoal : goal,
              ),
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Monthly goal could not be saved right now.",
            );
          });
      },
      deleteMonthlyGoal(id) {
        const previousMonthlyGoals = latestStateRef.current.monthlyGoals;
        const previousWeeklyGoals = latestStateRef.current.weeklyGoals;
        const previousDailyTasks = latestStateRef.current.dailyTasks;

        if (!previousMonthlyGoals.some((goal) => goal.id === id)) {
          return;
        }

        commit((currentState) => ({
          ...currentState,
          monthlyGoals: currentState.monthlyGoals.filter((goal) => goal.id !== id),
          weeklyGoals: currentState.weeklyGoals.map((goal) =>
            goal.monthlyGoalId === id
              ? {
                  ...goal,
                  monthlyGoalId: null,
                  updatedAt: new Date().toISOString(),
                }
              : goal,
          ),
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.monthlyGoalId === id
              ? {
                  ...task,
                  monthlyGoalId: null,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        }));

        if (!user) {
          return;
        }

        void deleteMonthlyGoalById(id)
          .then(() => {
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              monthlyGoals: previousMonthlyGoals,
              weeklyGoals: previousWeeklyGoals,
              dailyTasks: previousDailyTasks,
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Monthly goal could not be deleted right now.",
            );
          });
      },
      addWeeklyGoal(input) {
        if (!user) {
          commit((currentState) => ({
            ...currentState,
            weeklyGoals: [...currentState.weeklyGoals, buildWeeklyGoal(input)],
          }));
          return;
        }

        const optimisticGoal = buildWeeklyGoal(input);
        const optimisticState = commit((currentState) => ({
          ...currentState,
          weeklyGoals: [...currentState.weeklyGoals, optimisticGoal],
        }));
        const normalizedGoal =
          optimisticState.weeklyGoals.find((goal) => goal.id === optimisticGoal.id) ??
          optimisticGoal;

        void createWeeklyGoalRequest({
          id: normalizedGoal.id,
          ...toWeeklyGoalApiPayload(normalizedGoal),
          createdAt: optimisticGoal.createdAt,
        })
          .then((savedGoal) => {
            commit((currentState) => ({
              ...currentState,
              weeklyGoals: upsertById(currentState.weeklyGoals, savedGoal),
            }));
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              weeklyGoals: currentState.weeklyGoals.filter(
                (goal) => goal.id !== optimisticGoal.id,
              ),
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Weekly goal could not be saved right now.",
            );
          });
      },
      updateWeeklyGoal(id, updates) {
        const previousGoal = latestStateRef.current.weeklyGoals.find(
          (goal) => goal.id === id,
        );

        if (!previousGoal) {
          return;
        }

        if (!user) {
          commit((currentState) => ({
            ...currentState,
            weeklyGoals: currentState.weeklyGoals.map((goal) =>
              goal.id === id ? applyWeeklyGoalUpdates(goal, updates) : goal,
            ),
          }));
          return;
        }

        const optimisticState = commit((currentState) => ({
          ...currentState,
          weeklyGoals: currentState.weeklyGoals.map((goal) =>
            goal.id === id ? applyWeeklyGoalUpdates(goal, updates) : goal,
          ),
        }));
        const normalizedGoal = optimisticState.weeklyGoals.find(
          (goal) => goal.id === id,
        );

        if (!normalizedGoal) {
          return;
        }

        void updateWeeklyGoalById(id, toWeeklyGoalApiPayload(normalizedGoal))
          .then((savedGoal) => {
            commit((currentState) => ({
              ...currentState,
              weeklyGoals: currentState.weeklyGoals.map((goal) =>
                goal.id === savedGoal.id ? savedGoal : goal,
              ),
            }));
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              weeklyGoals: currentState.weeklyGoals.map((goal) =>
                goal.id === id ? previousGoal : goal,
              ),
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Weekly goal could not be saved right now.",
            );
          });
      },
      deleteWeeklyGoal(id) {
        const previousWeeklyGoals = latestStateRef.current.weeklyGoals;
        const previousDailyTasks = latestStateRef.current.dailyTasks;

        if (!previousWeeklyGoals.some((goal) => goal.id === id)) {
          return;
        }

        commit((currentState) => ({
          ...currentState,
          weeklyGoals: currentState.weeklyGoals.filter((goal) => goal.id !== id),
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.weeklyGoalId === id
              ? applyDailyTaskUpdates(task, { weeklyGoalId: null })
              : task,
          ),
        }));

        if (!user) {
          return;
        }

        void deleteWeeklyGoalById(id)
          .then(() => {
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              weeklyGoals: previousWeeklyGoals,
              dailyTasks: previousDailyTasks,
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Weekly goal could not be deleted right now.",
            );
          });
      },
      addDailyTask(input) {
        if (!user) {
          const guestTask = normalizeDailyTaskGoalLinks(
            buildDailyTask(input),
            latestStateRef.current.monthlyGoals,
            latestStateRef.current.weeklyGoals,
          );
          commit((currentState) => ({
            ...currentState,
            dailyTasks: [...currentState.dailyTasks, guestTask],
          }));
          return;
        }

        const optimisticTask = buildDailyTask(input);
        const normalizedOptimisticTask = normalizeDailyTaskGoalLinks(
          optimisticTask,
          latestStateRef.current.monthlyGoals,
          latestStateRef.current.weeklyGoals,
        );
        const optimisticState = commit((currentState) => ({
          ...currentState,
          dailyTasks: [...currentState.dailyTasks, normalizedOptimisticTask],
        }));
        const normalizedTask =
          optimisticState.dailyTasks.find((task) => task.id === normalizedOptimisticTask.id) ??
          normalizedOptimisticTask;

        void createDailyTaskRequest({
          id: normalizedTask.id,
          ...toDailyTaskApiPayload(normalizedTask),
          createdAt: optimisticTask.createdAt,
        })
          .then((savedTask) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: upsertById(currentState.dailyTasks, savedTask),
            }));
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: currentState.dailyTasks.filter(
                (task) => task.id !== normalizedOptimisticTask.id,
              ),
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Daily task could not be saved right now.",
            );
          });
      },
      updateDailyTask(id, updates) {
        const previousTask = latestStateRef.current.dailyTasks.find(
          (task) => task.id === id,
        );

        if (!previousTask) {
          return;
        }

        if (!user) {
          commit((currentState) => ({
            ...currentState,
            dailyTasks: currentState.dailyTasks.map((task) =>
              task.id === id
                ? normalizeDailyTaskGoalLinks(
                    applyDailyTaskUpdates(task, updates),
                    currentState.monthlyGoals,
                    currentState.weeklyGoals,
                  )
                : task,
            ),
          }));
          return;
        }

        const optimisticState = commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.id === id
              ? normalizeDailyTaskGoalLinks(
                  applyDailyTaskUpdates(task, updates),
                  currentState.monthlyGoals,
                  currentState.weeklyGoals,
                )
              : task,
          ),
        }));
        const normalizedTask = optimisticState.dailyTasks.find(
          (task) => task.id === id,
        );

        if (!normalizedTask) {
          return;
        }

        void updateDailyTaskById(id, toDailyTaskApiPayload(normalizedTask))
          .then((savedTask) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: currentState.dailyTasks.map((task) =>
                task.id === savedTask.id ? savedTask : task,
              ),
            }));
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: currentState.dailyTasks.map((task) =>
                task.id === id ? previousTask : task,
              ),
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Daily task could not be saved right now.",
            );
          });
      },
      deleteDailyTask(id) {
        const previousDailyTasks = latestStateRef.current.dailyTasks;

        if (!previousDailyTasks.some((task) => task.id === id)) {
          return;
        }

        commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.filter((task) => task.id !== id),
        }));

        if (!user) {
          return;
        }

        void deleteDailyTaskById(id)
          .then(() => {
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: previousDailyTasks,
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Daily task could not be deleted right now.",
            );
          });
      },
      toggleTask(id) {
        const previousTask = latestStateRef.current.dailyTasks.find(
          (task) => task.id === id,
        );

        if (!previousTask) {
          return;
        }

        const optimisticState = commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.id === id
              ? applyDailyTaskUpdates(task, { completed: !task.completed })
              : task,
          ),
        }));

        if (!user) {
          return;
        }

        const normalizedTask = optimisticState.dailyTasks.find(
          (task) => task.id === id,
        );

        if (!normalizedTask) {
          return;
        }

        void updateDailyTaskById(id, toDailyTaskApiPayload(normalizedTask))
          .then((savedTask) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: currentState.dailyTasks.map((task) =>
                task.id === savedTask.id ? savedTask : task,
              ),
            }));
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: currentState.dailyTasks.map((task) =>
                task.id === id ? previousTask : task,
              ),
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Daily task could not be saved right now.",
            );
          });
      },
      rescheduleTask(id, newDate) {
        const previousTask = latestStateRef.current.dailyTasks.find(
          (task) => task.id === id,
        );

        if (!previousTask) {
          return;
        }

        const optimisticState = commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.id === id
              ? normalizeDailyTaskGoalLinks(
                  applyDailyTaskUpdates(task, {
                    date: newDate,
                    carryOverCount: task.completed
                      ? task.carryOverCount
                      : task.carryOverCount + 1,
                  }),
                  currentState.monthlyGoals,
                  currentState.weeklyGoals,
                )
              : task,
          ),
        }));

        if (!user) {
          return;
        }

        const normalizedTask = optimisticState.dailyTasks.find(
          (task) => task.id === id,
        );

        if (!normalizedTask) {
          return;
        }

        void updateDailyTaskById(id, toDailyTaskApiPayload(normalizedTask))
          .then((savedTask) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: currentState.dailyTasks.map((task) =>
                task.id === savedTask.id ? savedTask : task,
              ),
            }));
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: currentState.dailyTasks.map((task) =>
                task.id === id ? previousTask : task,
              ),
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Daily task could not be saved right now.",
            );
          });
      },
      splitTask(id) {
        const previousDailyTasks = latestStateRef.current.dailyTasks;
        const sourceTask = previousDailyTasks.find((task) => task.id === id);

        if (!sourceTask) {
          return;
        }

        const splitOffTask: DailyTask = {
          ...sourceTask,
          id: createId("task"),
          title: `First step: ${sourceTask.title}`,
          note: "Created from carry-over support to make the task easier to start.",
          priority: sourceTask.priority === "high" ? "medium" : sourceTask.priority,
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const optimisticState = commit((currentState) => ({
          ...currentState,
          dailyTasks: [
            ...currentState.dailyTasks.map((task) =>
              task.id === id
                ? applyDailyTaskUpdates(task, {
                    note: task.note
                      ? `${task.note} Smaller first step created.`
                      : "Smaller first step created.",
                  })
                : task,
            ),
            splitOffTask,
          ],
        }));

        if (!user) {
          return;
        }

        const normalizedSourceTask = optimisticState.dailyTasks.find(
          (task) => task.id === id,
        );
        const normalizedSplitTask = optimisticState.dailyTasks.find(
          (task) => task.id === splitOffTask.id,
        );

        if (!normalizedSourceTask || !normalizedSplitTask) {
          return;
        }

        void (async () => {
          try {
            await updateDailyTaskById(id, toDailyTaskApiPayload(normalizedSourceTask));

            try {
              await createDailyTaskRequest({
                id: normalizedSplitTask.id,
                ...toDailyTaskApiPayload(normalizedSplitTask),
                createdAt: splitOffTask.createdAt,
              });
            } catch (caughtError) {
              await updateDailyTaskById(id, toDailyTaskApiPayload(sourceTask)).catch(
                () => undefined,
              );
              throw caughtError;
            }

            setPlanningError(null);
          } catch (caughtError) {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: previousDailyTasks,
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Daily task could not be split right now.",
            );
          }
        })();
      },
      convertTaskToWeeklyGoal(id) {
        const previousWeeklyGoals = latestStateRef.current.weeklyGoals;
        const previousDailyTasks = latestStateRef.current.dailyTasks;
        const task = previousDailyTasks.find((item) => item.id === id);

        if (!task) {
          return;
        }

        const parentWeeklyGoal = previousWeeklyGoals.find(
          (goal) => goal.id === task.weeklyGoalId,
        );
        const sourceWeek = getWeekRange(task.date);
        const optimisticWeeklyGoal = buildWeeklyGoal({
          monthlyGoalId: parentWeeklyGoal?.monthlyGoalId ?? null,
          title: toTitleCase(task.title),
          description:
            task.note ||
            "Created from a postponed daily task so it can live at the weekly level.",
          startDate: parentWeeklyGoal?.startDate ?? sourceWeek.startKey,
          endDate: parentWeeklyGoal?.endDate ?? sourceWeek.endKey,
          lifeArea: task.lifeArea,
          status: "not_started",
        });

        commit((currentState) => ({
          ...currentState,
          weeklyGoals: [...currentState.weeklyGoals, optimisticWeeklyGoal],
          dailyTasks: currentState.dailyTasks.filter((item) => item.id !== id),
        }));

        if (!user) {
          return;
        }

        void (async () => {
          try {
            const savedGoal = await createWeeklyGoalRequest({
              id: optimisticWeeklyGoal.id,
              ...toWeeklyGoalApiPayload(optimisticWeeklyGoal),
              createdAt: optimisticWeeklyGoal.createdAt,
            });

            try {
              await deleteDailyTaskById(id);
            } catch (caughtError) {
              await deleteWeeklyGoalById(savedGoal.id).catch(() => undefined);
              throw caughtError;
            }

            commit((currentState) => ({
              ...currentState,
              weeklyGoals: currentState.weeklyGoals.map((goal) =>
                goal.id === savedGoal.id ? savedGoal : goal,
              ),
            }));
            setPlanningError(null);
          } catch (caughtError) {
            commit((currentState) => ({
              ...currentState,
              weeklyGoals: previousWeeklyGoals,
              dailyTasks: previousDailyTasks,
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Task could not be converted to a weekly goal right now.",
            );
          }
        })();
      },
      deprioritizeTask(id) {
        const previousTask = latestStateRef.current.dailyTasks.find(
          (task) => task.id === id,
        );

        if (!previousTask) {
          return;
        }

        const optimisticState = commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.id === id
              ? applyDailyTaskUpdates(task, {
                  priority: "low",
                  date: toDateKey(
                    new Date(Date.parse(task.date) + 24 * 60 * 60 * 1000),
                  ),
                  carryOverCount: task.carryOverCount + 1,
                })
              : task,
          ),
        }));

        if (!user) {
          return;
        }

        const normalizedTask = optimisticState.dailyTasks.find(
          (task) => task.id === id,
        );

        if (!normalizedTask) {
          return;
        }

        void updateDailyTaskById(id, toDailyTaskApiPayload(normalizedTask))
          .then((savedTask) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: currentState.dailyTasks.map((task) =>
                task.id === savedTask.id ? savedTask : task,
              ),
            }));
            setPlanningError(null);
          })
          .catch((caughtError) => {
            commit((currentState) => ({
              ...currentState,
              dailyTasks: currentState.dailyTasks.map((task) =>
                task.id === id ? previousTask : task,
              ),
            }));
            setPlanningError(
              caughtError instanceof Error
                ? caughtError.message
                : "Daily task could not be saved right now.",
            );
          });
      },
      setDailyFocus(input) {
        commit((currentState) => {
          const existingFocus = currentState.dailyFocuses.find(
            (focus) => focus.date === input.date,
          );

          if (!existingFocus) {
            return {
              ...currentState,
              dailyFocuses: [...currentState.dailyFocuses, buildDailyFocus(input)],
            };
          }

          return {
            ...currentState,
            dailyFocuses: currentState.dailyFocuses.map((focus) =>
              focus.date === input.date
                ? {
                    ...focus,
                    mainFocus: input.mainFocus,
                    secondaryFocuses: input.secondaryFocuses,
                    updatedAt: new Date().toISOString(),
                  }
                : focus,
            ),
          };
        });
      },
      async saveJournalEntry(input) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[journal-save]", "save-started", {
            date: input.date,
            sections: input.sections,
            rawTranscriptLength: input.rawTranscript.length,
            editedTranscriptLength: input.editedTranscript.length,
            tomorrowSetup: input.tomorrowSetup,
          });
        }

        let savedEntry: JournalEntry | null = null;

        try {
          if (user) {
            const savedEntry = await saveJournalEntryRequest({
              ...input,
              language,
              lifeAreas: latestStateRef.current.lifeAreas,
            });

            setState((currentState) =>
              recalculateAppState({
                ...currentState,
                journalEntries: upsertJournalEntry(
                  currentState.journalEntries,
                  savedEntry,
                ),
              }),
            );

            if (process.env.NODE_ENV === "development") {
              console.debug("[journal-save]", "save-succeeded", {
                date: savedEntry.date,
                id: savedEntry.id,
                source: "database",
              });
            }

            return savedEntry;
          }

          commit((currentState) => {
            const existingEntry = currentState.journalEntries.find(
              (entry) => entry.date === input.date,
            );
            const entry = buildLocalJournalEntry(currentState, input, existingEntry);
            savedEntry = entry;

            if (process.env.NODE_ENV === "development") {
              console.debug("[journal-save]", "assembled-payload", entry);
            }

            return {
              ...currentState,
              journalEntries: currentState.journalEntries.some(
                (currentEntry) => currentEntry.date === input.date,
              )
                ? currentState.journalEntries.map((currentEntry) =>
                    currentEntry.date === input.date ? entry : currentEntry,
                  )
                : [...currentState.journalEntries, entry].sort((left, right) =>
                    left.date.localeCompare(right.date),
                  ),
            };
          });

          if (!savedEntry) {
            throw new Error("Journal entry could not be assembled for saving.");
          }

          const finalizedEntry = savedEntry as JournalEntry;

          if (process.env.NODE_ENV === "development") {
            console.debug("[journal-save]", "save-succeeded", {
              date: finalizedEntry.date,
              id: finalizedEntry.id,
            });
          }

          return finalizedEntry;
        } catch (caughtError) {
          if (process.env.NODE_ENV === "development") {
            console.error("[journal-save]", "save-failed", caughtError);
          }

          throw caughtError instanceof Error
            ? caughtError
            : new Error("Journal could not be saved. Try again.");
        }
      },
      async saveJournalSection(date, input) {
        if (user) {
          const savedEntry = await saveJournalSectionByDate(date, input.sectionKey, {
            content: input.content,
            rawTranscript: input.rawTranscript,
            editedTranscript: input.editedTranscript,
            language,
            lifeAreas: latestStateRef.current.lifeAreas,
          });

          setState((currentState) =>
            recalculateAppState({
              ...currentState,
              journalEntries: upsertJournalEntry(
                currentState.journalEntries,
                savedEntry,
              ),
            }),
          );

          return savedEntry;
        }

        let savedEntry: JournalEntry | null = null;

        commit((currentState) => {
          const existingEntry = currentState.journalEntries.find(
            (entry) => entry.date === date,
          );
          const nextSections = {
            ...(existingEntry?.sections ?? {}),
            [input.sectionKey]: {
              memo: input.content,
            },
          };
          const entry = buildLocalJournalEntry(
            currentState,
            {
              date,
              sections: nextSections,
              rawTranscript: input.rawTranscript,
              editedTranscript: input.editedTranscript,
              tomorrowSetup: existingEntry?.tomorrowSetup ?? {
                mainFocus: "",
                topTasks: [],
                watchOutFor: "",
                intention: "",
              },
            },
            existingEntry,
          );

          savedEntry = entry;

          return {
            ...currentState,
            journalEntries: upsertJournalEntry(currentState.journalEntries, entry),
          };
        });

        if (!savedEntry) {
          throw new Error("Journal section could not be saved right now.");
        }

        return savedEntry;
      },
      async saveTomorrowSetup(date, input) {
        if (user) {
          const savedEntry = await saveTomorrowSetupByDate(date, {
            tomorrowSetup: input.tomorrowSetup,
            rawTranscript: input.rawTranscript,
            editedTranscript: input.editedTranscript,
            language,
            lifeAreas: latestStateRef.current.lifeAreas,
          });

          setState((currentState) =>
            recalculateAppState({
              ...currentState,
              journalEntries: upsertJournalEntry(
                currentState.journalEntries,
                savedEntry,
              ),
            }),
          );

          return savedEntry;
        }

        let savedEntry: JournalEntry | null = null;

        commit((currentState) => {
          const existingEntry = currentState.journalEntries.find(
            (entry) => entry.date === date,
          );
          const entry = buildLocalJournalEntry(
            currentState,
            {
              date,
              sections: existingEntry?.sections ?? {},
              rawTranscript: input.rawTranscript,
              editedTranscript: input.editedTranscript,
              tomorrowSetup: input.tomorrowSetup,
            },
            existingEntry,
          );

          savedEntry = entry;

          return {
            ...currentState,
            journalEntries: upsertJournalEntry(currentState.journalEntries, entry),
          };
        });

        if (!savedEntry) {
          throw new Error("Tomorrow setup could not be saved right now.");
        }

        return savedEntry;
      },
      async finalizeJournalEntry(date) {
        if (user) {
          const savedEntry = await finalizeJournalEntryByDate(date, {
            lifeAreas: latestStateRef.current.lifeAreas,
          });

          setState((currentState) =>
            recalculateAppState({
              ...currentState,
              journalEntries: upsertJournalEntry(
                currentState.journalEntries,
                savedEntry,
              ),
            }),
          );

          return savedEntry;
        }

        throw new Error("Log in om je journal af te ronden.");
      },
      async updateJournalSummary(date, updates) {
        if (user) {
          const updatedEntry = await updateJournalSummaryByDate(date, {
            ...updates,
            lifeAreas: latestStateRef.current.lifeAreas,
          });

          if (updatedEntry) {
            setState((currentState) =>
              recalculateAppState({
                ...currentState,
                journalEntries: upsertJournalEntry(
                  currentState.journalEntries,
                  updatedEntry,
                ),
              }),
            );
          }

          return updatedEntry;
        }

        let updatedEntry: JournalEntry | null = null;

        commit((currentState) => {
          const timestamp = new Date().toISOString();

          const journalEntries = currentState.journalEntries.map((entry) => {
            if (entry.date !== date) {
              return entry;
            }

            updatedEntry = {
              ...entry,
              aiSummary: updates.aiSummary ?? entry.aiSummary,
              aiSummaryError:
                updates.aiSummaryError === undefined
                  ? entry.aiSummaryError
                  : updates.aiSummaryError,
              aiSummaryUpdatedAt:
                updates.aiSummary !== undefined ? timestamp : entry.aiSummaryUpdatedAt,
              updatedAt: timestamp,
            };

            return updatedEntry;
          });

          return {
            ...currentState,
            journalEntries,
          };
        });

        return updatedEntry;
      },
      addLifeArea(name) {
        const normalized = name.trim().toLowerCase();
        if (!normalized) {
          return;
        }

        commit((currentState) => {
          if (currentState.lifeAreas.includes(normalized)) {
            return currentState;
          }

          return {
            ...currentState,
            lifeAreas: [...currentState.lifeAreas, normalized].sort((left, right) =>
              left.localeCompare(right),
            ),
          };
        });
      },
    };
  }, [
    commit,
    isHydrated,
    journalError,
    journalStatus,
    language,
    planningError,
    planningStatus,
    state,
    storageError,
    user,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
