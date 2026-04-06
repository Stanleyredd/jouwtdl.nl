"use client";

import { getISOWeek } from "date-fns";
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
  listJournalEntriesForUser,
  saveJournalEntryForUser,
  updateJournalSummaryForUser,
} from "@/services/journal-persistence-service";
import { recalculateAppState } from "@/services/planning-service";
import { loadAppState, saveAppState } from "@/services/storage-service";
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
  WeeklyGoal,
  WeeklyGoalInput,
} from "@/types";

interface AppContextValue {
  state: AppState;
  isHydrated: boolean;
  isJournalReady: boolean;
  journalStatus: "idle" | "loading" | "ready" | "error";
  storageError: string | null;
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
    weekNumber: getISOWeek(new Date(input.startDate)),
    startDate: input.startDate,
    endDate: input.endDate,
    lifeArea: input.lifeArea,
    status: input.status ?? "not_started",
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

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, supabase, isReady: isAuthReady, isConfigured } = useAuth();
  const { language } = useLanguage();
  const [state, setState] = useState<AppState>(() => createEmptyState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [journalStatus, setJournalStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [journalError, setJournalError] = useState<string | null>(null);
  const journalRequestIdRef = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const loaded = loadAppState();
      setState(recalculateAppState(loaded.state));
      setStorageError(loaded.error);
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const saveError = saveAppState(state, {
      includeJournalEntries: !(isConfigured && user && supabase),
    });
    setStorageError(saveError);
  }, [isConfigured, isHydrated, state, supabase, user]);

  useEffect(() => {
    if (!isHydrated || !isAuthReady) {
      return;
    }

    if (!isConfigured) {
      setJournalError(null);
      setJournalStatus("ready");
      return;
    }

    journalRequestIdRef.current += 1;
    const requestId = journalRequestIdRef.current;

    if (!user || !supabase) {
      setJournalError(null);
      setJournalStatus("ready");
      setState((currentState) =>
        currentState.journalEntries.length > 0
          ? { ...currentState, journalEntries: [] }
          : currentState,
      );
      return;
    }

    setJournalStatus("loading");
    setJournalError(null);
    setState((currentState) => ({
      ...currentState,
      journalEntries: [],
    }));

    void listJournalEntriesForUser(supabase, user.id, state.lifeAreas)
      .then((entries) => {
        if (journalRequestIdRef.current !== requestId) {
          return;
        }

        setState((currentState) =>
          recalculateAppState({
            ...currentState,
            journalEntries: entries,
          }),
        );
        setJournalStatus("ready");
      })
      .catch((caughtError) => {
        if (journalRequestIdRef.current !== requestId) {
          return;
        }

        setState((currentState) => ({
          ...currentState,
          journalEntries: [],
        }));
        setJournalStatus("error");
        setJournalError(
          caughtError instanceof Error
            ? caughtError.message
            : "Journal entries could not be loaded right now.",
        );
      });
  }, [isAuthReady, isConfigured, isHydrated, state.lifeAreas, supabase, user]);

  const commit = useCallback((updater: (currentState: AppState) => AppState) => {
    setState((currentState) => recalculateAppState(updater(currentState)));
  }, []);

  const value = useMemo<AppContextValue>(() => {
    return {
      state,
      isHydrated,
      isJournalReady: journalStatus !== "loading",
      journalStatus,
      storageError,
      journalError,
      addMonthlyGoal(input) {
        commit((currentState) => ({
          ...currentState,
          monthlyGoals: [...currentState.monthlyGoals, buildMonthlyGoal(input)],
        }));
      },
      updateMonthlyGoal(id, updates) {
        commit((currentState) => ({
          ...currentState,
          monthlyGoals: currentState.monthlyGoals.map((goal) =>
            goal.id === id
              ? { ...goal, ...updates, updatedAt: new Date().toISOString() }
              : goal,
          ),
        }));
      },
      deleteMonthlyGoal(id) {
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
        }));
      },
      addWeeklyGoal(input) {
        commit((currentState) => ({
          ...currentState,
          weeklyGoals: [...currentState.weeklyGoals, buildWeeklyGoal(input)],
        }));
      },
      updateWeeklyGoal(id, updates) {
        commit((currentState) => ({
          ...currentState,
          weeklyGoals: currentState.weeklyGoals.map((goal) =>
            goal.id === id
              ? {
                  ...goal,
                  ...updates,
                  weekNumber: updates.startDate
                    ? getISOWeek(new Date(updates.startDate))
                    : goal.weekNumber,
                  updatedAt: new Date().toISOString(),
                }
              : goal,
          ),
        }));
      },
      deleteWeeklyGoal(id) {
        commit((currentState) => ({
          ...currentState,
          weeklyGoals: currentState.weeklyGoals.filter((goal) => goal.id !== id),
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.weeklyGoalId === id
              ? {
                  ...task,
                  weeklyGoalId: null,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        }));
      },
      addDailyTask(input) {
        commit((currentState) => ({
          ...currentState,
          dailyTasks: [...currentState.dailyTasks, buildDailyTask(input)],
        }));
      },
      updateDailyTask(id, updates) {
        commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.id === id
              ? { ...task, ...updates, updatedAt: new Date().toISOString() }
              : task,
          ),
        }));
      },
      deleteDailyTask(id) {
        commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.filter((task) => task.id !== id),
        }));
      },
      toggleTask(id) {
        commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  completed: !task.completed,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        }));
      },
      rescheduleTask(id, newDate) {
        commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  date: newDate,
                  carryOverCount: task.completed ? task.carryOverCount : task.carryOverCount + 1,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        }));
      },
      splitTask(id) {
        commit((currentState) => {
          const sourceTask = currentState.dailyTasks.find((task) => task.id === id);
          if (!sourceTask) {
            return currentState;
          }

          return {
            ...currentState,
            dailyTasks: [
              ...currentState.dailyTasks.map((task) =>
                task.id === id
                  ? {
                      ...task,
                      note: task.note
                        ? `${task.note} Smaller first step created.`
                        : "Smaller first step created.",
                      updatedAt: new Date().toISOString(),
                    }
                  : task,
              ),
              {
                ...sourceTask,
                id: createId("task"),
                title: `First step: ${sourceTask.title}`,
                note: "Created from carry-over support to make the task easier to start.",
                priority: sourceTask.priority === "high" ? "medium" : sourceTask.priority,
                completed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          };
        });
      },
      convertTaskToWeeklyGoal(id) {
        commit((currentState) => {
          const task = currentState.dailyTasks.find((item) => item.id === id);
          if (!task) {
            return currentState;
          }

          const parentWeeklyGoal = currentState.weeklyGoals.find(
            (goal) => goal.id === task.weeklyGoalId,
          );
          const sourceWeek = getWeekRange(task.date);

          return {
            ...currentState,
            weeklyGoals: [
              ...currentState.weeklyGoals,
              buildWeeklyGoal({
                monthlyGoalId: parentWeeklyGoal?.monthlyGoalId ?? null,
                title: toTitleCase(task.title),
                description:
                  task.note ||
                  "Created from a postponed daily task so it can live at the weekly level.",
                startDate: parentWeeklyGoal?.startDate ?? sourceWeek.startKey,
                endDate: parentWeeklyGoal?.endDate ?? sourceWeek.endKey,
                lifeArea: task.lifeArea,
                status: "not_started",
              }),
            ],
            dailyTasks: currentState.dailyTasks.filter((item) => item.id !== id),
          };
        });
      },
      deprioritizeTask(id) {
        commit((currentState) => ({
          ...currentState,
          dailyTasks: currentState.dailyTasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  priority: "low",
                  date: toDateKey(new Date(Date.parse(task.date) + 24 * 60 * 60 * 1000)),
                  carryOverCount: task.carryOverCount + 1,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        }));
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
          if (user && supabase) {
            const savedEntry = await saveJournalEntryForUser({
              client: supabase,
              userId: user.id,
              input,
              language,
              lifeAreas: state.lifeAreas,
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
                source: "supabase",
              });
            }

            return savedEntry;
          }

          commit((currentState) => {
            const timestamp = new Date().toISOString();
            const existingEntry = currentState.journalEntries.find(
              (entry) => entry.date === input.date,
            );
            const analysis = analyzeJournalEntryContent(input, currentState.lifeAreas);

            const entry: JournalEntry = {
              id: existingEntry?.id ?? createId("journal"),
              date: input.date,
              sections: input.sections,
              rawTranscript: input.rawTranscript,
              editedTranscript: input.editedTranscript,
              aiSummary: existingEntry?.aiSummary ?? "",
              aiSummaryError: existingEntry?.aiSummaryError ?? null,
              aiSummaryUpdatedAt: existingEntry?.aiSummaryUpdatedAt,
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
      async updateJournalSummary(date, updates) {
        if (user && supabase) {
          const updatedEntry = await updateJournalSummaryForUser({
            client: supabase,
            userId: user.id,
            date,
            updates,
            lifeAreas: state.lifeAreas,
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
    state,
    storageError,
    supabase,
    user,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
