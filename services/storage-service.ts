import { normalizeJournalSections } from "@/data/journal-template";
import { createEmptyState, createSeedState } from "@/data/seed";
import type { AppState } from "@/types";

const STORAGE_KEY = "clarity-system::state";
const CURRENT_VERSION = 1;

export function loadAppState() {
  if (typeof window === "undefined") {
    return {
      state: createEmptyState(),
      error: null,
    };
  }

  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);

    if (!rawState) {
      return {
        state: normalizeLoadedState(createSeedState(new Date())),
        error: null,
      };
    }

    const parsedState = JSON.parse(rawState) as AppState;

    if (parsedState.version !== CURRENT_VERSION) {
      return {
        state: normalizeLoadedState(createSeedState(new Date())),
        error: "Saved data was from an older MVP version, so a fresh local workspace was created.",
      };
    }

    return {
      state: normalizeLoadedState(parsedState),
      error: null,
    };
  } catch {
    return {
      state: normalizeLoadedState(createSeedState(new Date())),
      error: "There was a problem reading local data, so the app reset to a clean local seed.",
    };
  }
}

export function saveAppState(
  state: AppState,
  options?: {
    includeJournalEntries?: boolean;
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

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
    return null;
  } catch {
    return "Local data could not be saved. Check browser storage settings and try again.";
  }
}

function normalizeLoadedState(state: AppState): AppState {
  return {
    ...state,
    journalEntries: state.journalEntries.map((entry) => ({
      ...entry,
      sections: normalizeJournalSections(entry.sections),
      rawTranscript: entry.rawTranscript ?? "",
      editedTranscript: entry.editedTranscript ?? "",
      aiSummary: entry.aiSummary ?? "",
      aiSummaryError: entry.aiSummaryError ?? null,
      aiSummaryUpdatedAt: entry.aiSummaryUpdatedAt,
    })),
  };
}
