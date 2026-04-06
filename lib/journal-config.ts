import { createId, toTitleCase } from "@/lib/utils";
import type {
  JournalConfig,
  JournalConfigSection,
  JournalFieldValues,
  JournalPreset,
  JournalSections,
} from "@/types";
import type { AppLanguage } from "@/lib/i18n";

export const JOURNAL_PRESETS = [
  "trading",
  "business",
  "personal",
  "custom",
] as const satisfies readonly JournalPreset[];

interface PresetCopy {
  title: string;
  description: string;
}

interface PresetSectionSeed {
  id: string;
  title: string;
  description: string;
  placeholder: string;
  rows: number;
}

interface PresetDefinition {
  title: string;
  description: string;
  sections: PresetSectionSeed[];
}

const DEFAULT_SECTION_ROWS = 5;

const presetCopy: Record<AppLanguage, Record<JournalPreset, PresetCopy>> = {
  nl: {
    trading: {
      title: "Trading",
      description: "Voor marktanalyse, trades en reflectie op uitvoering.",
    },
    business: {
      title: "Business",
      description: "Voor werk, voortgang, gesprekken en volgende stappen.",
    },
    personal: {
      title: "Persoonlijk",
      description: "Voor energie, gewoontes, reflectie en wat belangrijk was.",
    },
    custom: {
      title: "Zelf samenstellen",
      description: "Begin simpel en maak je eigen journalstructuur.",
    },
  },
  en: {
    trading: {
      title: "Trading",
      description: "For market analysis, trades, and execution reflection.",
    },
    business: {
      title: "Business",
      description: "For work, progress, conversations, and next steps.",
    },
    personal: {
      title: "Personal",
      description: "For energy, habits, reflection, and what mattered most.",
    },
    custom: {
      title: "Custom",
      description: "Start simple and shape your own journal structure.",
    },
  },
};

const presetDefinitions: Record<AppLanguage, Record<JournalPreset, PresetDefinition>> = {
  nl: {
    trading: {
      title: "Trading",
      description: "Voor marktanalyse, trades en reflectie op uitvoering.",
      sections: [
        {
          id: "morning_market_analysis",
          title: "Morning Market Analysis",
          description: "Je marktbeeld voordat de dag druk wordt.",
          placeholder:
            "Beschrijf de structuur, belangrijke levels en wat je wilt zien voordat je handelt.",
          rows: 6,
        },
        {
          id: "trades",
          title: "Trades",
          description: "Welke trades je nam en wat daarbij opviel.",
          placeholder:
            "Vat je trades, emoties en opvallende momenten kort samen.",
          rows: 6,
        },
        {
          id: "trends",
          title: "Trends",
          description: "De bredere context rond de dag.",
          placeholder:
            "Noteer trends, sentiment, nieuws of macrofactoren die vandaag meespeelden.",
          rows: 5,
        },
        {
          id: "end_of_day",
          title: "End of the Day",
          description: "Hoe de dag echt verliep.",
          placeholder:
            "Reflecteer op de dag, je uitvoering en wat je wilt onthouden.",
          rows: 6,
        },
        {
          id: "power_update",
          title: "Power Update",
          description: "Je energie, focus en eventuele reset.",
          placeholder:
            "Beschrijf je energie en focus. Voeg een cijfer toe als dat helpt.",
          rows: 4,
        },
        {
          id: "one_sentence_summary",
          title: "One Sentence Summary of the Day",
          description: "Eén zin die de dag eerlijk samenvat.",
          placeholder: "Vat de dag samen in één korte zin.",
          rows: 3,
        },
      ],
    },
    business: {
      title: "Business",
      description: "Voor werk, voortgang, gesprekken en volgende stappen.",
      sections: [
        {
          id: "main_work",
          title: "Main Work",
          description: "Het belangrijkste werk van vandaag.",
          placeholder:
            "Wat heb je gedaan, afgemaakt of vooruitgeschoven in je werk?",
          rows: 6,
        },
        {
          id: "important_conversations",
          title: "Important Conversations",
          description: "Gesprekken, feedback of beslissingen.",
          placeholder:
            "Leg vast welke gesprekken belangrijk waren en wat eruit kwam.",
          rows: 5,
        },
        {
          id: "progress_and_wins",
          title: "Progress & Wins",
          description: "Wat vooruitging of goed werkte.",
          placeholder:
            "Welke voortgang heb je gemaakt en wat voelde als winst?",
          rows: 5,
        },
        {
          id: "problems_blockers",
          title: "Problems / Blockers",
          description: "Waar liep je vast of wat remde je af?",
          placeholder:
            "Beschrijf problemen, blokkades of frictie die je merkte.",
          rows: 5,
        },
        {
          id: "energy_focus",
          title: "Energy & Focus",
          description: "Hoe je energie en aandacht vandaag waren.",
          placeholder:
            "Hoe voelde je energie en focus door de dag heen?",
          rows: 4,
        },
        {
          id: "one_sentence_summary",
          title: "One Sentence Summary",
          description: "Eén zin die de werkdag samenvat.",
          placeholder: "Vat de dag samen in één korte zin.",
          rows: 3,
        },
      ],
    },
    personal: {
      title: "Persoonlijk",
      description: "Voor energie, gewoontes, reflectie en wat belangrijk was.",
      sections: [
        {
          id: "morning_reflection",
          title: "Morning Reflection",
          description: "Hoe je de dag begon.",
          placeholder:
            "Wat voelde belangrijk toen je de dag begon?",
          rows: 5,
        },
        {
          id: "what_happened_today",
          title: "What Happened Today",
          description: "De belangrijkste momenten van de dag.",
          placeholder:
            "Wat gebeurde er vandaag en wat bleef hangen?",
          rows: 6,
        },
        {
          id: "habits_health",
          title: "Habits / Health",
          description: "Gewoontes, lichaam en herstel.",
          placeholder:
            "Hoe gingen slaap, beweging, voeding of andere gewoontes?",
          rows: 5,
        },
        {
          id: "energy_mood",
          title: "Energy & Mood",
          description: "Je energie en stemming.",
          placeholder:
            "Hoe voelde je energie en stemming vandaag?",
          rows: 4,
        },
        {
          id: "lessons_gratitude",
          title: "Lessons / Gratitude",
          description: "Wat je meeneemt uit de dag.",
          placeholder:
            "Welke les of dankbaarheid wil je meenemen?",
          rows: 4,
        },
        {
          id: "one_sentence_summary",
          title: "One Sentence Summary",
          description: "Eén zin die de dag samenvat.",
          placeholder: "Vat de dag samen in één korte zin.",
          rows: 3,
        },
      ],
    },
    custom: {
      title: "Zelf samenstellen",
      description: "Begin simpel en maak je eigen journalstructuur.",
      sections: [
        {
          id: "main_reflection",
          title: "Hoofdreflectie",
          description: "Waar wil je vandaag vooral op terugkijken?",
          placeholder: "Schrijf of spreek hier je belangrijkste reflectie in.",
          rows: 6,
        },
        {
          id: "energy_and_mood",
          title: "Energie & stemming",
          description: "Hoe voelde je je vandaag?",
          placeholder: "Beschrijf kort je energie, stemming en focus.",
          rows: 4,
        },
        {
          id: "next_focus",
          title: "Volgende focus",
          description: "Wat wil je meenemen naar morgen?",
          placeholder: "Wat verdient morgen je aandacht?",
          rows: 4,
        },
      ],
    },
  },
  en: {
    trading: {
      title: "Trading",
      description: "For market analysis, trades, and execution reflection.",
      sections: [
        {
          id: "morning_market_analysis",
          title: "Morning Market Analysis",
          description: "Your market read before the day gets noisy.",
          placeholder:
            "Describe the structure, important levels, and what you want to see before acting.",
          rows: 6,
        },
        {
          id: "trades",
          title: "Trades",
          description: "What you traded and what stood out.",
          placeholder:
            "Summarize your trades, emotions, and anything unusual you want to remember.",
          rows: 6,
        },
        {
          id: "trends",
          title: "Trends",
          description: "The broader context around the day.",
          placeholder:
            "Capture trends, sentiment, news, or macro context that mattered today.",
          rows: 5,
        },
        {
          id: "end_of_day",
          title: "End of the Day",
          description: "How the day really went.",
          placeholder:
            "Reflect on the day, your execution, and what you want to remember.",
          rows: 6,
        },
        {
          id: "power_update",
          title: "Power Update",
          description: "Your energy, focus, and any reset.",
          placeholder:
            "Describe your energy and focus. Add a score if that helps.",
          rows: 4,
        },
        {
          id: "one_sentence_summary",
          title: "One Sentence Summary of the Day",
          description: "One sentence that captures the day honestly.",
          placeholder: "Summarize the day in one short sentence.",
          rows: 3,
        },
      ],
    },
    business: {
      title: "Business",
      description: "For work, progress, conversations, and next steps.",
      sections: [
        {
          id: "main_work",
          title: "Main Work",
          description: "The most important work from today.",
          placeholder:
            "What did you work on, finish, or move forward today?",
          rows: 6,
        },
        {
          id: "important_conversations",
          title: "Important Conversations",
          description: "Key conversations, feedback, or decisions.",
          placeholder:
            "Capture the conversations that mattered and what came out of them.",
          rows: 5,
        },
        {
          id: "progress_and_wins",
          title: "Progress & Wins",
          description: "What moved forward or went well.",
          placeholder:
            "What progress did you make, and what felt like a win?",
          rows: 5,
        },
        {
          id: "problems_blockers",
          title: "Problems / Blockers",
          description: "What slowed you down or got in the way.",
          placeholder:
            "Describe any blockers, friction, or unresolved problems.",
          rows: 5,
        },
        {
          id: "energy_focus",
          title: "Energy & Focus",
          description: "How your energy and attention felt.",
          placeholder:
            "How did your energy and focus shift through the day?",
          rows: 4,
        },
        {
          id: "one_sentence_summary",
          title: "One Sentence Summary",
          description: "One sentence that captures the workday.",
          placeholder: "Summarize the day in one short sentence.",
          rows: 3,
        },
      ],
    },
    personal: {
      title: "Personal",
      description: "For energy, habits, reflection, and what mattered most.",
      sections: [
        {
          id: "morning_reflection",
          title: "Morning Reflection",
          description: "How you started the day.",
          placeholder:
            "What felt important when the day began?",
          rows: 5,
        },
        {
          id: "what_happened_today",
          title: "What Happened Today",
          description: "The most important moments from the day.",
          placeholder:
            "What happened today, and what stayed with you?",
          rows: 6,
        },
        {
          id: "habits_health",
          title: "Habits / Health",
          description: "Habits, body, and recovery.",
          placeholder:
            "How did sleep, movement, food, or other habits go today?",
          rows: 5,
        },
        {
          id: "energy_mood",
          title: "Energy & Mood",
          description: "Your energy and emotional tone.",
          placeholder:
            "How did your energy and mood feel today?",
          rows: 4,
        },
        {
          id: "lessons_gratitude",
          title: "Lessons / Gratitude",
          description: "What you want to carry forward.",
          placeholder:
            "What lesson, appreciation, or reminder do you want to keep?",
          rows: 4,
        },
        {
          id: "one_sentence_summary",
          title: "One Sentence Summary",
          description: "One sentence that captures the day.",
          placeholder: "Summarize the day in one short sentence.",
          rows: 3,
        },
      ],
    },
    custom: {
      title: "Custom",
      description: "Start simple and shape your own journal structure.",
      sections: [
        {
          id: "main_reflection",
          title: "Main Reflection",
          description: "What do you want to reflect on today?",
          placeholder: "Write or speak your main reflection here.",
          rows: 6,
        },
        {
          id: "energy_and_mood",
          title: "Energy & Mood",
          description: "How did you feel today?",
          placeholder: "Describe your energy, mood, and focus.",
          rows: 4,
        },
        {
          id: "next_focus",
          title: "Next Focus",
          description: "What should carry into tomorrow?",
          placeholder: "What deserves your attention next?",
          rows: 4,
        },
      ],
    },
  },
};

function humanizeSectionKey(sectionKey: string) {
  return toTitleCase(sectionKey.replaceAll("_", " ").replaceAll("-", " "));
}

function sanitizeSectionId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `section_${createId("journal").slice(-8)}`;
}

function sortSections(sections: JournalConfigSection[]) {
  return [...sections].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.title.localeCompare(right.title);
  });
}

function normalizeSection(
  section: Partial<JournalConfigSection>,
  fallbackOrder: number,
): JournalConfigSection {
  const title = (section.title ?? "").trim() || humanizeSectionKey(section.id ?? "section");

  return {
    id: sanitizeSectionId(section.id ?? title),
    title,
    description: (section.description ?? "").trim(),
    placeholder: (section.placeholder ?? "").trim(),
    rows:
      typeof section.rows === "number" && Number.isFinite(section.rows)
        ? Math.min(Math.max(Math.round(section.rows), 3), 12)
        : DEFAULT_SECTION_ROWS,
    enabled: section.enabled !== false,
    order:
      typeof section.order === "number" && Number.isFinite(section.order)
        ? section.order
        : fallbackOrder,
  };
}

function dedupeSections(sections: JournalConfigSection[]) {
  const seenIds = new Set<string>();
  return sections.filter((section) => {
    if (seenIds.has(section.id)) {
      return false;
    }

    seenIds.add(section.id);
    return true;
  });
}

export function normalizeJournalPreset(value: string | null | undefined): JournalPreset {
  return JOURNAL_PRESETS.includes(value as JournalPreset)
    ? (value as JournalPreset)
    : "trading";
}

export function getJournalPresetOptions(language: AppLanguage) {
  return JOURNAL_PRESETS.map((preset) => ({
    id: preset,
    title: presetCopy[language][preset].title,
    description: presetCopy[language][preset].description,
  }));
}

export function createPresetJournalConfig(
  preset: JournalPreset,
  language: AppLanguage,
): JournalConfig {
  const definition = presetDefinitions[language][preset];

  return {
    tomorrowSetupEnabled: true,
    sections: definition.sections.map((section, index) =>
      normalizeSection(
        {
          ...section,
          order: index + 1,
          enabled: true,
        },
        index + 1,
      ),
    ),
  };
}

export function normalizeJournalConfig(
  source: unknown,
  fallbackLanguage: AppLanguage = "nl",
  fallbackPreset: JournalPreset = "trading",
): JournalConfig {
  const fallbackConfig = createPresetJournalConfig(fallbackPreset, fallbackLanguage);

  if (!source || typeof source !== "object") {
    return fallbackConfig;
  }

  const candidate = source as Partial<JournalConfig>;
  const rawSections = Array.isArray(candidate.sections) ? candidate.sections : [];
  const normalizedSections = dedupeSections(
    sortSections(
      rawSections.map((section, index) =>
        normalizeSection(section as Partial<JournalConfigSection>, index + 1),
      ),
    ),
  );

  return {
    tomorrowSetupEnabled: candidate.tomorrowSetupEnabled !== false,
    sections: normalizedSections.length > 0 ? normalizedSections : fallbackConfig.sections,
  };
}

export function getEnabledJournalConfigSections(config: JournalConfig) {
  return sortSections(config.sections).filter((section) => section.enabled);
}

export function createEmptyJournalSectionsFromConfig(config: JournalConfig) {
  return getEnabledJournalConfigSections(config).reduce<JournalSections>((sections, section) => {
    sections[section.id] = { memo: "" };
    return sections;
  }, {});
}

function getMemoValue(value: JournalFieldValues | undefined) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const memo = typeof value.memo === "string" ? value.memo.trim() : "";
  if (memo) {
    return memo;
  }

  return Object.values(value)
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .join("\n\n")
    .trim();
}

export function normalizeJournalSectionsWithConfig(
  source: JournalSections | undefined,
  config: JournalConfig,
) {
  const normalized = createEmptyJournalSectionsFromConfig(config);

  for (const [sectionKey, value] of Object.entries(source ?? {})) {
    normalized[sectionKey] = {
      memo: getMemoValue(value),
    };
  }

  return normalized;
}

export function buildStructuredJournalTextWithConfig(
  sections: JournalSections,
  config: JournalConfig,
) {
  const titleLookup = new Map(
    config.sections.map((section) => [section.id, section.title]),
  );
  const enabledSectionIds = getEnabledJournalConfigSections(config).map((section) => section.id);
  const extraSectionIds = Object.keys(sections).filter(
    (sectionId) => !enabledSectionIds.includes(sectionId),
  );

  return [...enabledSectionIds, ...extraSectionIds]
    .map((sectionId) => {
      const memo = sections[sectionId]?.memo?.trim();

      if (!memo) {
        return null;
      }

      return `${titleLookup.get(sectionId) ?? humanizeSectionKey(sectionId)}\n${memo}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function buildJournalTemplateSections(config: JournalConfig) {
  return getEnabledJournalConfigSections(config).map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    fields: [
      {
        id: "memo",
        label: "Memo",
        helperText: "",
        placeholder: section.placeholder,
        rows: section.rows,
      },
    ],
  }));
}

export function createCustomJournalSection(language: AppLanguage, order: number) {
  return normalizeSection(
    {
      id: createId("section"),
      title: language === "nl" ? "Nieuwe sectie" : "New section",
      description:
        language === "nl"
          ? "Beschrijf waar deze sectie voor bedoeld is."
          : "Describe what this section is for.",
      placeholder:
        language === "nl"
          ? "Wat wil je hier vastleggen?"
          : "What do you want to capture here?",
      rows: DEFAULT_SECTION_ROWS,
      enabled: true,
      order,
    },
    order,
  );
}
