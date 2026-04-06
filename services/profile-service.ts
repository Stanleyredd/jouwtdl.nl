import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  normalizeJournalConfig,
  normalizeJournalPreset,
} from "@/lib/journal-config";
import type { AppLanguage } from "@/lib/i18n";
import type { Database, Json } from "@/types/database";
import type { JournalConfig, JournalPreset, UserProfile } from "@/types";

type TypedSupabaseClient = SupabaseClient<Database>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface SaveProfileInput {
  onboardingCompleted?: boolean;
  journalPreset?: JournalPreset | null;
  journalConfig?: JournalConfig | null;
}

const DEFAULT_LANGUAGE: AppLanguage = "nl";
const DEFAULT_THEME = "light";
const DEFAULT_SHOW_TOMORROW = true;

function serializeError(error: unknown) {
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

function logProfileDebug(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug("[profile-service]", event, payload);
  console.debug("[profile-service]", `${event}:details`, JSON.stringify(payload, null, 2));
}

function toDatabaseJson(value: JournalConfig | null | undefined): Json | null {
  return value ? (value as unknown as Json) : null;
}

function normalizeProfileInput(input: SaveProfileInput) {
  const journalPreset =
    input.journalPreset === null || input.journalPreset === undefined
      ? input.journalPreset
      : normalizeJournalPreset(input.journalPreset);
  const fallbackPreset = journalPreset ?? "trading";

  return {
    onboardingCompleted: input.onboardingCompleted,
    journalPreset,
    journalConfig:
      input.journalConfig === null || input.journalConfig === undefined
        ? input.journalConfig
        : normalizeJournalConfig(input.journalConfig, "nl", fallbackPreset),
  };
}

function logSupabaseProfileError(
  action: "load" | "save",
  userId: string,
  error: unknown,
  payload?: unknown,
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error("[profile-service]", `profile-${action}-failed`, {
    userId,
    error: serializeError(error),
    payload,
  });
  console.error(
    "[profile-service]",
    `profile-${action}-failed:details`,
    JSON.stringify(
      {
        userId,
        error: serializeError(error),
        payload,
      },
      null,
      2,
    ),
  );
}

function getMissingProfileColumns(error: unknown) {
  const serialized = serializeError(error);
  const rawMessage = serialized.message ?? "";
  const matches = [...rawMessage.matchAll(/'([^']+)' column of 'profiles'/g)];
  return matches.map((match) => match[1]);
}

function getProfileSchemaMismatchMessage(error: unknown) {
  const missingColumns = getMissingProfileColumns(error);

  if (missingColumns.length === 0) {
    return null;
  }

  const columnList = missingColumns.join(", ");
  return `Your Supabase profiles table is missing required columns (${columnList}). Run the latest profiles migration and refresh the app.`;
}

function mapProfileRow(row: ProfileRow): UserProfile {
  const rawRow = row as Record<string, unknown>;
  const rawJournalConfig = rawRow.journal_config;
  const rawJournalPreset = rawRow.journal_preset;
  const normalizedJournalPreset =
    typeof rawJournalPreset === "string"
      ? normalizeJournalPreset(rawJournalPreset)
      : null;
  const journalConfig = rawJournalConfig
    ? normalizeJournalConfig(rawJournalConfig, DEFAULT_LANGUAGE, normalizedJournalPreset ?? "trading")
    : null;
  const rawEnabledSections = rawRow.journal_sections_enabled;
  const enabledSections = Array.isArray(rawEnabledSections)
    ? rawEnabledSections.filter((value): value is string => typeof value === "string")
    : journalConfig?.sections
        .filter((section) => section.enabled)
        .map((section) => section.id) ?? [];

  return {
    id: typeof rawRow.id === "string" ? rawRow.id : row.id,
    email: typeof rawRow.email === "string" ? rawRow.email : "",
    language: rawRow.language === "en" ? "en" : DEFAULT_LANGUAGE,
    theme: rawRow.theme === "dark" ? "dark" : DEFAULT_THEME,
    showTomorrow:
      typeof rawRow.show_tomorrow === "boolean"
        ? rawRow.show_tomorrow
        : DEFAULT_SHOW_TOMORROW,
    journalSectionsEnabled: enabledSections,
    onboardingCompleted:
      typeof rawRow.onboarding_completed === "boolean"
        ? rawRow.onboarding_completed
        : false,
    journalPreset: normalizedJournalPreset,
    journalConfig,
    createdAt:
      typeof rawRow.created_at === "string"
        ? rawRow.created_at
        : new Date().toISOString(),
    updatedAt:
      typeof rawRow.updated_at === "string"
        ? rawRow.updated_at
        : new Date().toISOString(),
  };
}

async function selectProfileRow(
  client: TypedSupabaseClient,
  userId: string,
) {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logSupabaseProfileError("load", userId, error);
    throw new Error("Your profile could not be loaded right now.");
  }

  return data;
}

export async function getProfileForUser(
  client: TypedSupabaseClient,
  userId: string,
) {
  const row = await selectProfileRow(client, userId);
  return row ? mapProfileRow(row) : null;
}

export async function ensureProfileForUser(
  client: TypedSupabaseClient,
  user: Pick<User, "id" | "email">,
) {
  logProfileDebug("profile-load-started", {
    userId: user.id,
    email: user.email ?? "",
  });

  const existingProfile = await getProfileForUser(client, user.id);

  logProfileDebug("profile-load-result", {
    userId: user.id,
    found: Boolean(existingProfile),
  });

  if (existingProfile) {
    logProfileDebug("final-profile-state", {
      userId: user.id,
      onboardingCompleted: existingProfile.onboardingCompleted,
      journalPreset: existingProfile.journalPreset,
      hasJournalConfig: Boolean(existingProfile.journalConfig),
    });

    return existingProfile;
  }

  logProfileDebug("profile-missing", {
    userId: user.id,
  });

  logProfileDebug("profile-create-started", {
    userId: user.id,
  });

  let createdProfile: UserProfile;

  try {
    createdProfile = await saveProfileForUser(client, user, {});
  } catch (caughtError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[profile-service]", "profile-create-failed", {
        userId: user.id,
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Unknown profile creation failure.",
      });
    }

    throw caughtError;
  }

  logProfileDebug("profile-create-succeeded", {
    userId: user.id,
    onboardingCompleted: createdProfile.onboardingCompleted,
    journalPreset: createdProfile.journalPreset,
    hasJournalConfig: Boolean(createdProfile.journalConfig),
  });

  logProfileDebug("profile-load-retry", {
    userId: user.id,
  });

  const retryProfile = await getProfileForUser(client, user.id);
  const finalProfile = retryProfile ?? createdProfile;

  logProfileDebug("final-profile-state", {
    userId: user.id,
    onboardingCompleted: finalProfile.onboardingCompleted,
    journalPreset: finalProfile.journalPreset,
    hasJournalConfig: Boolean(finalProfile.journalConfig),
  });

  return finalProfile;
}

export async function loadProfileForUser(
  client: TypedSupabaseClient,
  user: Pick<User, "id" | "email">,
) {
  return ensureProfileForUser(client, user);
}

export async function saveProfileForUser(
  client: TypedSupabaseClient,
  user: Pick<User, "id" | "email">,
  input: SaveProfileInput,
) {
  const normalizedInput = normalizeProfileInput(input);
  const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: user.id,
    email: user.email ?? "",
  };

  if (normalizedInput.onboardingCompleted !== undefined) {
    payload.onboarding_completed = normalizedInput.onboardingCompleted;
  }

  if (normalizedInput.journalPreset !== undefined) {
    payload.journal_preset = normalizedInput.journalPreset;
  }

  if (normalizedInput.journalConfig !== undefined) {
    payload.journal_config = toDatabaseJson(normalizedInput.journalConfig);
  }

  logProfileDebug("profile-save-payload", {
    mode: "create-or-upsert",
    userId: user.id,
    payload,
  });

  const { data, error } = await client
    .from("profiles")
    .upsert(payload, {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error) {
      logSupabaseProfileError("save", user.id, error, payload);
      const schemaMismatchMessage = getProfileSchemaMismatchMessage(error);

      if (schemaMismatchMessage) {
        throw new Error(schemaMismatchMessage);
      }
    }
    throw new Error("Your profile could not be saved right now.");
  }

  logProfileDebug("profile-save-succeeded", {
    mode: "create-or-upsert",
    userId: user.id,
    onboardingCompleted: data.onboarding_completed,
    journalPreset: data.journal_preset,
    hasJournalConfig: Boolean(data.journal_config),
  });
  return mapProfileRow(data);
}

export async function updateProfileForUser(
  client: TypedSupabaseClient,
  user: Pick<User, "id" | "email">,
  input: SaveProfileInput,
) {
  const normalizedInput = normalizeProfileInput(input);
  const payload: Database["public"]["Tables"]["profiles"]["Update"] = {
    email: user.email ?? "",
  };

  if (normalizedInput.onboardingCompleted !== undefined) {
    payload.onboarding_completed = normalizedInput.onboardingCompleted;
  }

  if (normalizedInput.journalPreset !== undefined) {
    payload.journal_preset = normalizedInput.journalPreset;
  }

  if (normalizedInput.journalConfig !== undefined) {
    payload.journal_config = toDatabaseJson(normalizedInput.journalConfig);
  }

  const upsertPayload = {
    id: user.id,
    email: user.email ?? "",
    ...payload,
  };

  logProfileDebug("profile-save-payload", {
    mode: "update-or-upsert",
    userId: user.id,
    payload: upsertPayload,
  });

  const { data, error } = await client
    .from("profiles")
    .upsert(upsertPayload, {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error) {
      logSupabaseProfileError("save", user.id, error, upsertPayload);
      const schemaMismatchMessage = getProfileSchemaMismatchMessage(error);

      if (schemaMismatchMessage) {
        throw new Error(schemaMismatchMessage);
      }
    }
    throw new Error("Your profile could not be saved right now.");
  }

  logProfileDebug("profile-save-succeeded", {
    mode: "update-or-upsert",
    userId: user.id,
    onboardingCompleted: data.onboarding_completed,
    journalPreset: data.journal_preset,
    hasJournalConfig: Boolean(data.journal_config),
  });
  return mapProfileRow(data);
}

export function getProfileJournalPreset(profile: UserProfile | null) {
  return profile?.journalPreset ?? "trading";
}

export function getProfileJournalConfig(
  profile: UserProfile | null,
  language: AppLanguage,
) {
  return normalizeJournalConfig(
    profile?.journalConfig,
    language,
    getProfileJournalPreset(profile),
  );
}
