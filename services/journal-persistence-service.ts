import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeJournalSections } from "@/data/journal-template";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { analyzeJournalEntryContent } from "@/services/analysis-service";
import type {
  JournalEntry,
  JournalEntryInput,
  JournalSections,
  TomorrowSetup,
} from "@/types";
import type { Database } from "@/types/database";

type JournalEntryRow = Database["public"]["Tables"]["journal_entries"]["Row"];
type JournalSectionRow = Database["public"]["Tables"]["journal_sections"]["Row"];
type TomorrowSetupRow = Database["public"]["Tables"]["tomorrow_setups"]["Row"];
type TypedSupabaseClient = SupabaseClient<Database>;

const emptyTomorrowSetup: TomorrowSetup = {
  mainFocus: "",
  topTasks: [],
  watchOutFor: "",
  intention: "",
};

function serializeJournalError(error: unknown) {
  if (!(error instanceof Error) && (typeof error !== "object" || error === null)) {
    return {
      message: String(error),
    };
  }

  const candidate = error as Error & {
    code?: string;
    details?: string;
    hint?: string;
    name?: string;
    status?: number;
  };

  return {
    name: candidate.name,
    message: candidate.message,
    code: candidate.code,
    details: candidate.details,
    hint: candidate.hint,
    status: candidate.status,
    keys: Object.keys(candidate),
  };
}

function logJournalDebug(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug("[journal-persistence]", event, payload);
  console.debug(
    "[journal-persistence]",
    `${event}:details`,
    JSON.stringify(payload, null, 2),
  );
}

function logJournalPersistenceError(
  action: "load" | "save",
  table: "journal_entries" | "journal_sections" | "tomorrow_setups",
  userId: string,
  error: unknown,
  payload?: unknown,
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const errorPayload = {
    action,
    table,
    userId,
    payloadKeys:
      payload && typeof payload === "object"
        ? Object.keys(payload as Record<string, unknown>)
        : null,
    error: serializeJournalError(error),
    payload,
  };

  console.error("[journal-persistence]", "journal-request-failed", errorPayload);
  console.error(
    "[journal-persistence]",
    "journal-request-failed:details",
    JSON.stringify(errorPayload, null, 2),
  );
}

function getJournalSchemaMismatchMessage(error: unknown) {
  const serialized = serializeJournalError(error);
  const message = serialized.message ?? "";

  const missingColumnMatch = message.match(/Could not find the '([^']+)' column of '([^']+)'/);
  if (missingColumnMatch) {
    const [, column, table] = missingColumnMatch;
    return `Your Supabase journal schema is missing ${table}.${column}. Run the latest journal migration and refresh the app.`;
  }

  const missingTableMatch = message.match(/Could not find the table '([^']+)' in the schema cache/);
  if (missingTableMatch) {
    return `Your Supabase journal schema is missing ${missingTableMatch[1]}. Run the latest journal migration and refresh the app.`;
  }

  const missingRelationMatch = message.match(/relation \"([^\"]+)\" does not exist/i);
  if (missingRelationMatch) {
    return `Your Supabase journal schema is missing ${missingRelationMatch[1]}. Run the latest journal migration and refresh the app.`;
  }

  const conflictConstraintMatch = message.match(/there is no unique or exclusion constraint matching the ON CONFLICT specification/i);
  if (conflictConstraintMatch) {
    return "Your Supabase journal schema is missing the required unique constraints for journal saving. Run the latest journal migration and refresh the app.";
  }

  const permissionMatch = message.match(/permission denied/i);
  if (permissionMatch) {
    return "Your Supabase journal tables are missing the required grants or RLS permissions. Run the latest journal migration and refresh the app.";
  }

  return null;
}

function throwJournalPersistenceError(
  action: "load" | "save",
  table: "journal_entries" | "journal_sections" | "tomorrow_setups",
  userId: string,
  error: unknown,
  fallbackMessage: string,
  payload?: unknown,
): never {
  logJournalPersistenceError(action, table, userId, error, payload);

  const schemaMismatchMessage = getJournalSchemaMismatchMessage(error);
  if (schemaMismatchMessage) {
    throw new Error(schemaMismatchMessage);
  }

  throw new Error(fallbackMessage);
}

export async function listJournalEntriesForUser(
  client: TypedSupabaseClient,
  userId: string,
  lifeAreas: string[],
) {
  logJournalDebug("journal-load-started", {
    table: "journal_entries",
    userId,
  });

  const { data: entryRows, error: entryError } = await client
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: true });

  if (entryError) {
    throwJournalPersistenceError(
      "load",
      "journal_entries",
      userId,
      entryError,
      "Journal entries could not be loaded right now.",
    );
  }

  if (!entryRows || entryRows.length === 0) {
    logJournalDebug("journal-load-empty", {
      table: "journal_entries",
      userId,
    });
    return [] satisfies JournalEntry[];
  }

  logJournalDebug("journal-load-entries-found", {
    table: "journal_entries",
    userId,
    count: entryRows.length,
  });

  return loadEntriesByIds(client, userId, entryRows.map((entry) => entry.id), lifeAreas);
}

export async function saveJournalEntryForUser({
  client,
  userId,
  input,
  language,
  lifeAreas,
}: {
  client: TypedSupabaseClient;
  userId: string;
  input: JournalEntryInput;
  language: AppLanguage;
  lifeAreas: string[];
}) {
  const normalizedSections = normalizeJournalSections(input.sections);
  const normalizedTomorrow = normalizeTomorrowSetup(input.tomorrowSetup);
  const entryPayload = {
    user_id: userId,
    entry_date: input.date,
    language: normalizeLanguage(language),
    raw_transcript: input.rawTranscript,
    edited_transcript: input.editedTranscript,
    ai_summary_error: null,
  } satisfies Database["public"]["Tables"]["journal_entries"]["Insert"];

  logJournalDebug("journal-save-started", {
    userId,
    date: input.date,
    sectionCount: Object.keys(normalizedSections).length,
    topTaskCount: normalizedTomorrow.topTasks.length,
  });

  const { data: entryRow, error: entryError } = await client
    .from("journal_entries")
    .upsert(entryPayload, {
      onConflict: "user_id,entry_date",
    })
    .select("*")
    .single();

  if (entryError || !entryRow) {
    throwJournalPersistenceError(
      "save",
      "journal_entries",
      userId,
      entryError ?? new Error("Journal entry row missing after upsert."),
      "Journal could not be saved. Try again.",
      entryPayload,
    );
  }

  logJournalDebug("journal-entry-upsert-succeeded", {
    userId,
    entryId: entryRow.id,
    date: entryRow.entry_date,
  });

  const { error: deleteSectionsError } = await client
    .from("journal_sections")
    .delete()
    .eq("journal_entry_id", entryRow.id)
    .eq("user_id", userId);

  if (deleteSectionsError) {
    throwJournalPersistenceError(
      "save",
      "journal_sections",
      userId,
      deleteSectionsError,
      "Journal sections could not be saved right now.",
      {
        journal_entry_id: entryRow.id,
        user_id: userId,
      },
    );
  }

  const sectionRows = Object.entries(normalizedSections).map(([sectionKey, values]) => ({
    journal_entry_id: entryRow.id,
    user_id: userId,
    section_key: sectionKey,
    content: values.memo?.trim() ?? "",
  }));

  if (sectionRows.length > 0) {
    const { error: insertSectionsError } = await client
      .from("journal_sections")
      .insert(sectionRows);

    if (insertSectionsError) {
      throwJournalPersistenceError(
        "save",
        "journal_sections",
        userId,
        insertSectionsError,
        "Journal sections could not be saved right now.",
        {
          count: sectionRows.length,
          sample: sectionRows[0] ?? null,
        },
      );
    }
  }

  const tomorrowPayload = {
    journal_entry_id: entryRow.id,
    user_id: userId,
    focus: normalizedTomorrow.mainFocus,
    top_tasks: normalizedTomorrow.topTasks,
    watch_out_for: normalizedTomorrow.watchOutFor,
    intention: normalizedTomorrow.intention,
  } satisfies Database["public"]["Tables"]["tomorrow_setups"]["Insert"];

  const { error: tomorrowError } = await client
    .from("tomorrow_setups")
    .upsert(tomorrowPayload, {
      onConflict: "journal_entry_id",
    });

  if (tomorrowError) {
    throwJournalPersistenceError(
      "save",
      "tomorrow_setups",
      userId,
      tomorrowError,
      "Tomorrow setup could not be saved right now.",
      tomorrowPayload,
    );
  }

  logJournalDebug("journal-save-write-finished", {
    userId,
    entryId: entryRow.id,
    sectionCount: sectionRows.length,
    hasTomorrowSetup: true,
  });

  const [savedEntry] = await loadEntriesByIds(client, userId, [entryRow.id], lifeAreas);

  if (!savedEntry) {
    throw new Error("Journal could not be loaded after saving.");
  }

  return savedEntry;
}

export async function updateJournalSummaryForUser({
  client,
  userId,
  date,
  updates,
  lifeAreas,
}: {
  client: TypedSupabaseClient;
  userId: string;
  date: string;
  updates: {
    aiSummary?: string;
    aiSummaryError?: string | null;
  };
  lifeAreas: string[];
}) {
  const updatePayload: Database["public"]["Tables"]["journal_entries"]["Update"] = {};

  if (updates.aiSummary !== undefined) {
    updatePayload.ai_summary = updates.aiSummary;
    updatePayload.ai_summary_updated_at = new Date().toISOString();
  }

  if (updates.aiSummaryError !== undefined) {
    updatePayload.ai_summary_error = updates.aiSummaryError;
  }

  if (Object.keys(updatePayload).length === 0) {
    return null;
  }

  const { data: entryRow, error: updateError } = await client
    .from("journal_entries")
    .update(updatePayload)
    .eq("user_id", userId)
    .eq("entry_date", date)
    .select("*")
    .single();

  if (updateError) {
    throwJournalPersistenceError(
      "save",
      "journal_entries",
      userId,
      updateError,
      "Journal summary could not be saved right now.",
      {
        date,
        ...updatePayload,
      },
    );
  }

  if (!entryRow) {
    return null;
  }

  const [updatedEntry] = await loadEntriesByIds(client, userId, [entryRow.id], lifeAreas);
  return updatedEntry ?? null;
}

async function loadEntriesByIds(
  client: TypedSupabaseClient,
  userId: string,
  entryIds: string[],
  lifeAreas: string[],
) {
  const { data: entryRows, error: entryError } = await client
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .in("id", entryIds)
    .order("entry_date", { ascending: true });

  if (entryError) {
    throwJournalPersistenceError(
      "load",
      "journal_entries",
      userId,
      entryError,
      "Journal entries could not be loaded right now.",
      {
        entryIds,
      },
    );
  }

  const { data: sectionRows, error: sectionError } = await client
    .from("journal_sections")
    .select("*")
    .eq("user_id", userId)
    .in("journal_entry_id", entryIds)
    .order("created_at", { ascending: true });

  if (sectionError) {
    throwJournalPersistenceError(
      "load",
      "journal_sections",
      userId,
      sectionError,
      "Journal sections could not be loaded right now.",
      {
        entryIds,
      },
    );
  }

  const { data: tomorrowRows, error: tomorrowError } = await client
    .from("tomorrow_setups")
    .select("*")
    .eq("user_id", userId)
    .in("journal_entry_id", entryIds);

  if (tomorrowError) {
    throwJournalPersistenceError(
      "load",
      "tomorrow_setups",
      userId,
      tomorrowError,
      "Tomorrow setup could not be loaded right now.",
      {
        entryIds,
      },
    );
  }

  logJournalDebug("journal-load-related-succeeded", {
    userId,
    entryCount: entryRows?.length ?? 0,
    sectionCount: sectionRows?.length ?? 0,
    tomorrowCount: tomorrowRows?.length ?? 0,
  });

  return mapRowsToJournalEntries(
    entryRows ?? [],
    sectionRows ?? [],
    tomorrowRows ?? [],
    lifeAreas,
  );
}

function mapRowsToJournalEntries(
  entryRows: JournalEntryRow[],
  sectionRows: JournalSectionRow[],
  tomorrowRows: TomorrowSetupRow[],
  lifeAreas: string[],
) {
  const sectionsByEntryId = new Map<string, JournalSections>();

  for (const sectionRow of sectionRows) {
    const currentSections = sectionsByEntryId.get(sectionRow.journal_entry_id) ?? {};
    currentSections[sectionRow.section_key] = {
      memo: sectionRow.content ?? "",
    };
    sectionsByEntryId.set(sectionRow.journal_entry_id, currentSections);
  }

  const tomorrowByEntryId = new Map<string, TomorrowSetup>();

  for (const tomorrowRow of tomorrowRows) {
    tomorrowByEntryId.set(tomorrowRow.journal_entry_id, {
      mainFocus: tomorrowRow.focus ?? "",
      topTasks: tomorrowRow.top_tasks ?? [],
      watchOutFor: tomorrowRow.watch_out_for ?? "",
      intention: tomorrowRow.intention ?? "",
    });
  }

  return entryRows.map((entryRow) =>
    mapEntryRowToDomain(
      entryRow,
      sectionsByEntryId.get(entryRow.id),
      tomorrowByEntryId.get(entryRow.id),
      lifeAreas,
    ),
  );
}

function mapEntryRowToDomain(
  entryRow: JournalEntryRow,
  rawSections: JournalSections | undefined,
  tomorrowSetup: TomorrowSetup | undefined,
  lifeAreas: string[],
): JournalEntry {
  const sections = normalizeJournalSections(rawSections);
  const normalizedTomorrow = normalizeTomorrowSetup(tomorrowSetup);
  const analysis = analyzeJournalEntryContent(
    {
      date: entryRow.entry_date,
      sections,
      rawTranscript: entryRow.raw_transcript,
      editedTranscript: entryRow.edited_transcript,
      tomorrowSetup: normalizedTomorrow,
    },
    lifeAreas,
  );

  return {
    id: entryRow.id,
    date: entryRow.entry_date,
    sections,
    rawTranscript: entryRow.raw_transcript ?? "",
    editedTranscript: entryRow.edited_transcript ?? "",
    aiSummary: entryRow.ai_summary ?? "",
    aiSummaryError: entryRow.ai_summary_error,
    aiSummaryUpdatedAt: entryRow.ai_summary_updated_at ?? undefined,
    sentiment: analysis.sentiment,
    moodScore: analysis.moodScore,
    powerLevel: analysis.powerLevel,
    lifeAreasMentioned: analysis.lifeAreasMentioned,
    blockersDetected: analysis.blockersDetected,
    oneSentenceDaySummary: analysis.oneSentenceDaySummary,
    tomorrowSetup: normalizedTomorrow,
    createdAt: entryRow.created_at,
    updatedAt: entryRow.updated_at,
  };
}

function normalizeTomorrowSetup(setup?: TomorrowSetup) {
  if (!setup) {
    return emptyTomorrowSetup;
  }

  return {
    mainFocus: setup.mainFocus ?? "",
    topTasks: Array.isArray(setup.topTasks)
      ? setup.topTasks.map((item) => item.trim()).filter(Boolean)
      : [],
    watchOutFor: setup.watchOutFor ?? "",
    intention: setup.intention ?? "",
  };
}
