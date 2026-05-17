import {
  createPresetJournalConfig,
  normalizeJournalConfig,
  normalizeJournalPreset,
} from "@/lib/journal-config";
import type { AppLanguage } from "@/lib/i18n";
import type { JournalConfig, JournalPreset, UserProfile } from "@/types";

export interface SaveProfileInput {
  onboardingCompleted?: boolean;
  journalPreset?: JournalPreset | null;
  journalConfig?: JournalConfig | null;
}

export interface ProfileRecordShape {
  id: string;
  email: string;
  language: string;
  theme: string;
  showTomorrow: boolean;
  journalSectionsEnabled: unknown;
  onboardingCompleted: boolean;
  journalPreset: string | null;
  journalConfig: unknown | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const DEFAULT_LANGUAGE: AppLanguage = "nl";
const DEFAULT_THEME = "light";
const DEFAULT_SHOW_TOMORROW = true;
const DEFAULT_PRESET: JournalPreset = "trading";

export const DEFAULT_JOURNAL_SECTION_IDS = createPresetJournalConfig(
  DEFAULT_PRESET,
  DEFAULT_LANGUAGE,
).sections
  .filter((section) => section.enabled)
  .map((section) => section.id);

function normalizeTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

export function normalizeProfileInput(input: SaveProfileInput) {
  const journalPreset =
    input.journalPreset === null || input.journalPreset === undefined
      ? input.journalPreset
      : normalizeJournalPreset(input.journalPreset);
  const fallbackPreset = journalPreset ?? DEFAULT_PRESET;

  return {
    onboardingCompleted: input.onboardingCompleted,
    journalPreset,
    journalConfig:
      input.journalConfig === null || input.journalConfig === undefined
        ? input.journalConfig
        : normalizeJournalConfig(input.journalConfig, DEFAULT_LANGUAGE, fallbackPreset),
  };
}

export function mapProfileRecord(record: ProfileRecordShape): UserProfile {
  const normalizedJournalPreset = record.journalPreset
    ? normalizeJournalPreset(record.journalPreset)
    : null;
  const journalConfig = record.journalConfig
    ? normalizeJournalConfig(
        record.journalConfig,
        DEFAULT_LANGUAGE,
        normalizedJournalPreset ?? DEFAULT_PRESET,
      )
    : null;
  const enabledSections = Array.isArray(record.journalSectionsEnabled)
    ? record.journalSectionsEnabled.filter(
        (value): value is string => typeof value === "string",
      )
    : journalConfig?.sections
        .filter((section) => section.enabled)
        .map((section) => section.id) ?? DEFAULT_JOURNAL_SECTION_IDS;

  return {
    id: record.id,
    email: record.email,
    language: record.language === "en" ? "en" : DEFAULT_LANGUAGE,
    theme: record.theme === "dark" ? "dark" : DEFAULT_THEME,
    showTomorrow:
      typeof record.showTomorrow === "boolean"
        ? record.showTomorrow
        : DEFAULT_SHOW_TOMORROW,
    journalSectionsEnabled: enabledSections,
    onboardingCompleted:
      typeof record.onboardingCompleted === "boolean"
        ? record.onboardingCompleted
        : false,
    journalPreset: normalizedJournalPreset,
    journalConfig,
    createdAt: normalizeTimestamp(record.createdAt),
    updatedAt: normalizeTimestamp(record.updatedAt),
  };
}

export function getProfileJournalPreset(profile: UserProfile | null) {
  return profile?.journalPreset ?? DEFAULT_PRESET;
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
