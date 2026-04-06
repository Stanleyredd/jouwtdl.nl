import {
  buildJournalTemplateSections as buildJournalTemplateSectionsFromConfig,
  buildStructuredJournalTextWithConfig,
  createEmptyJournalSectionsFromConfig,
  createPresetJournalConfig,
  normalizeJournalConfig,
  normalizeJournalSectionsWithConfig,
} from "@/lib/journal-config";
import type { JournalConfig, JournalSections, JournalTemplateSection } from "@/types";

const defaultJournalConfig = createPresetJournalConfig("trading", "en");

export const journalTemplate: JournalTemplateSection[] =
  buildJournalTemplateSectionsFromConfig(defaultJournalConfig);

export function createEmptyJournalSections(config: JournalConfig = defaultJournalConfig) {
  return createEmptyJournalSectionsFromConfig(config);
}

export function normalizeJournalSections(
  source?: JournalSections,
  config: JournalConfig = defaultJournalConfig,
) {
  return normalizeJournalSectionsWithConfig(source, normalizeJournalConfig(config, "en"));
}

export function buildStructuredJournalText(
  sections: JournalSections,
  config: JournalConfig = defaultJournalConfig,
) {
  return buildStructuredJournalTextWithConfig(
    normalizeJournalSections(sections, config),
    normalizeJournalConfig(config, "en"),
  );
}

export function buildJournalTemplateSections(config: JournalConfig = defaultJournalConfig) {
  return buildJournalTemplateSectionsFromConfig(
    normalizeJournalConfig(config, "en"),
  );
}
