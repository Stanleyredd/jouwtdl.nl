import { normalizeJournalSections } from "@/data/journal-template";
import { createEmptyState, createSeedState } from "@/data/seed";
import type { AppState } from "@/types";

const STORAGE_PREFIX = "clarity-system::state";
const CURRENT_VERSION = 1;
const MONTHLY_GOALS_DATABASE_MIGRATION_KEY = "monthly-goals-db-v1";
const WEEKLY_GOALS_DATABASE_MIGRATION_KEY = "weekly-goals-db-v1";
const DAILY_TASKS_DATABASE_MIGRATION_KEY = "daily-tasks-db-v1";
const JOURNAL_ENTRIES_DATABASE_MIGRATION_KEY = "journal-entries-db-v1";

function getStorageKey(scope: string) {
  return `${STORAGE_PREFIX}::${scope}`;
}

function getMonthlyGoalsMigrationKey(scope: string) {
  return `${getStorageKey(scope)}::${MONTHLY_GOALS_DATABASE_MIGRATION_KEY}`;
}

function getWeeklyGoalsMigrationKey(scope: string) {
  return `${getStorageKey(scope)}::${WEEKLY_GOALS_DATABASE_MIGRATION_KEY}`;
}

function getDailyTasksMigrationKey(scope: string) {
  return `${getStorageKey(scope)}::${DAILY_TASKS_DATABASE_MIGRATION_KEY}`;
}

function getJournalEntriesMigrationKey(scope: string) {
  return `${getStorageKey(scope)}::${JOURNAL_ENTRIES_DATABASE_MIGRATION_KEY}`;
}

function createLocalBaselineState(useSeedData: boolean) {
  const baseState = useSeedData ? createSeedState(new Date()) : createEmptyState();

  return normalizeLoadedState({
    ...baseState,
    initializedAt: baseState.initializedAt || new Date().toISOString(),
  });
}

export function loadAppState(options?: {
  scope?: string;
  useSeedData?: boolean;
}) {
  if (typeof window === "undefined") {
    return {
      state: createEmptyState(),
      error: null,
    };
  }

  const scope = options?.scope ?? "guest";
  const useSeedData = options?.useSeedData ?? scope === "guest";
  const storageKey = getStorageKey(scope);

  try {
    const rawState =
      window.localStorage.getItem(storageKey) ??
      (scope === "guest" ? window.localStorage.getItem(STORAGE_PREFIX) : null);

    if (!rawState) {
      return {
        state: createLocalBaselineState(useSeedData),
        error: null,
      };
    }

    const parsedState = JSON.parse(rawState) as AppState;

    if (parsedState.version !== CURRENT_VERSION) {
      return {
        state: createLocalBaselineState(useSeedData),
        error: useSeedData
          ? "Saved data was from an older MVP version, so a fresh local workspace was created."
          : "Saved data was from an older local version, so this account received a clean local cache.",
      };
    }

    return {
      state: normalizeLoadedState(parsedState),
      error: null,
    };
  } catch {
    return {
      state: createLocalBaselineState(useSeedData),
      error: useSeedData
        ? "There was a problem reading local data, so the app reset to a clean local seed."
        : "There was a problem reading the local cache for this account, so it was reset.",
    };
  }
}

export function saveAppState(
  state: AppState,
  options?: {
    includeJournalEntries?: boolean;
    scope?: string;
  },
) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stateToPersist =
      options?.includeJournalEntries === false
        ? {
            ...state,
            journalEntries: [],
          }
        : state;

    window.localStorage.setItem(
      getStorageKey(options?.scope ?? "guest"),
      JSON.stringify(stateToPersist),
    );
    return null;
  } catch {
    return "Local data could not be saved. Check browser storage settings and try again.";
  }
}

export function hasCompletedMonthlyGoalsDatabaseMigration(scope: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getMonthlyGoalsMigrationKey(scope)) === "true";
}

export function markMonthlyGoalsDatabaseMigrationComplete(scope: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getMonthlyGoalsMigrationKey(scope), "true");
}

export function hasCompletedWeeklyGoalsDatabaseMigration(scope: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getWeeklyGoalsMigrationKey(scope)) === "true";
}

export function markWeeklyGoalsDatabaseMigrationComplete(scope: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getWeeklyGoalsMigrationKey(scope), "true");
}

export function hasCompletedDailyTasksDatabaseMigration(scope: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getDailyTasksMigrationKey(scope)) === "true";
}

export function markDailyTasksDatabaseMigrationComplete(scope: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getDailyTasksMigrationKey(scope), "true");
}

export function hasCompletedJournalEntriesDatabaseMigration(scope: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getJournalEntriesMigrationKey(scope)) === "true";
}

export function markJournalEntriesDatabaseMigrationComplete(scope: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getJournalEntriesMigrationKey(scope), "true");
}

function normalizeLoadedState(state: AppState): AppState {
  return {
    ...state,
    monthlyGoals: state.monthlyGoals.map((goal) => ({
      ...goal,
      progressMode: goal.progressMode ?? "linked_items",
    })),
    weeklyGoals: state.weeklyGoals.map((goal) => ({
      ...goal,
      progressMode: goal.progressMode ?? "linked_items",
    })),
    dailyTasks: state.dailyTasks.map((task) => ({
      ...task,
      monthlyGoalId: task.monthlyGoalId ?? null,
    })),
    journalEntries: state.journalEntries.map((entry) => ({
      ...entry,
      sections: normalizeJournalSections(entry.sections),
      rawTranscript: entry.rawTranscript ?? "",
      editedTranscript: entry.editedTranscript ?? "",
      aiSummary: entry.aiSummary ?? "",
      aiSummaryError: entry.aiSummaryError ?? null,
      aiSummaryUpdatedAt: entry.aiSummaryUpdatedAt,
      finalizedAt: entry.finalizedAt ?? null,
    })),
  };
}
