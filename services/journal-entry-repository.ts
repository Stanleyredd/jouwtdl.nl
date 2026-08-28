import "server-only";

import { type Prisma } from "@prisma/client";

import { normalizeJournalSections } from "@/data/journal-template";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { getPrismaClient } from "@/lib/prisma";
import { analyzeJournalEntryContent } from "@/services/analysis-service";
import type {
  JournalEntry,
  JournalEntryInput,
  JournalSections,
  TomorrowSetup,
} from "@/types";

type PrismaJournalEntryWithRelations = Prisma.JournalEntryGetPayload<{
  include: {
    sections: true;
    tomorrowSetup: true;
  };
}>;

const emptyTomorrowSetup: TomorrowSetup = {
  mainFocus: "",
  topTasks: [],
  watchOutFor: "",
  intention: "",
};

export interface SaveJournalEntryInput extends JournalEntryInput {
  language: AppLanguage;
  lifeAreas: string[];
  createdAt?: string;
  aiSummary?: string;
  aiSummaryError?: string | null;
  aiSummaryUpdatedAt?: string;
  finalizedAt?: string;
}

export interface UpdateJournalSummaryInput {
  lifeAreas: string[];
  aiSummary?: string;
  aiSummaryError?: string | null;
}

export interface SaveJournalEntryResult {
  journalEntry: JournalEntry;
  wasCreated: boolean;
}

export interface SaveJournalSectionInput {
  sectionKey: string;
  content: string;
  rawTranscript: string;
  editedTranscript: string;
  language: AppLanguage;
  lifeAreas: string[];
}

export interface SaveTomorrowSetupInput {
  rawTranscript: string;
  editedTranscript: string;
  tomorrowSetup: TomorrowSetup;
  language: AppLanguage;
  lifeAreas: string[];
}

export interface FinalizeJournalEntryPayload {
  lifeAreas: string[];
}

export interface FinalizeJournalEntryInput {
  lifeAreas: string[];
  aiSummary: string;
}

export interface FinalizeJournalEntryResult {
  journalEntry: JournalEntry;
  wasJustFinalized: boolean;
  shouldTriggerCompletionWebhook: boolean;
}

function parseDateOnly(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Use a valid journal date.");
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function parseTimestamp(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Use a valid timestamp.");
  }

  return parsed;
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

function mapPrismaEntryToDomain(
  entry: PrismaJournalEntryWithRelations,
  lifeAreas: string[],
): JournalEntry {
  const rawSections = entry.sections.reduce<JournalSections>((result, section) => {
    result[section.sectionKey] = {
      memo: section.content ?? "",
    };
    return result;
  }, {});
  const sections = normalizeJournalSections(rawSections);
  const tomorrowSetup = normalizeTomorrowSetup(
    entry.tomorrowSetup
      ? {
          mainFocus: entry.tomorrowSetup.focus,
          topTasks: entry.tomorrowSetup.topTasks,
          watchOutFor: entry.tomorrowSetup.watchOutFor,
          intention: entry.tomorrowSetup.intention,
        }
      : undefined,
  );
  const analysis = analyzeJournalEntryContent(
    {
      date: entry.entryDate.toISOString().slice(0, 10),
      sections,
      rawTranscript: entry.rawTranscript ?? "",
      editedTranscript: entry.editedTranscript ?? "",
      tomorrowSetup,
    },
    lifeAreas,
  );

  return {
    id: entry.id,
    date: entry.entryDate.toISOString().slice(0, 10),
    sections,
    rawTranscript: entry.rawTranscript ?? "",
    editedTranscript: entry.editedTranscript ?? "",
    aiSummary: entry.aiSummary ?? "",
    aiSummaryError: entry.aiSummaryError,
    aiSummaryUpdatedAt: entry.aiSummaryUpdatedAt?.toISOString(),
    finalizedAt: entry.finalizedAt?.toISOString() ?? null,
    sentiment: analysis.sentiment,
    moodScore: analysis.moodScore,
    powerLevel: analysis.powerLevel,
    lifeAreasMentioned: analysis.lifeAreasMentioned,
    blockersDetected: analysis.blockersDetected,
    oneSentenceDaySummary: analysis.oneSentenceDaySummary,
    tomorrowSetup,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

async function loadJournalEntryById(entryId: string, lifeAreas: string[]) {
  const prisma = getPrismaClient();
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: {
      sections: {
        orderBy: [{ createdAt: "asc" }],
      },
      tomorrowSetup: true,
    },
  });

  if (!entry) {
    return null;
  }

  return mapPrismaEntryToDomain(entry, lifeAreas);
}

async function loadJournalEntryByDate(
  userId: string,
  date: string,
  lifeAreas: string[],
) {
  const prisma = getPrismaClient();
  const entry = await prisma.journalEntry.findUnique({
    where: {
      userId_entryDate: {
        userId,
        entryDate: parseDateOnly(date),
      },
    },
    include: {
      sections: {
        orderBy: [{ createdAt: "asc" }],
      },
      tomorrowSetup: true,
    },
  });

  if (!entry) {
    return null;
  }

  return mapPrismaEntryToDomain(entry, lifeAreas);
}

async function ensureJournalEntryRecord(
  transaction: Prisma.TransactionClient,
  {
    userId,
    entryDate,
    language,
    rawTranscript,
    editedTranscript,
  }: {
    userId: string;
    entryDate: Date;
    language: AppLanguage;
    rawTranscript: string;
    editedTranscript: string;
  },
) {
  const existingEntry = await transaction.journalEntry.findUnique({
    where: {
      userId_entryDate: {
        userId,
        entryDate,
      },
    },
    select: {
      id: true,
    },
  });

  const journalEntry = existingEntry
    ? await transaction.journalEntry.update({
        where: {
          id: existingEntry.id,
        },
        data: {
          language: normalizeLanguage(language),
          rawTranscript,
          editedTranscript,
        },
      })
    : await transaction.journalEntry.create({
        data: {
          userId,
          entryDate,
          language: normalizeLanguage(language),
          rawTranscript,
          editedTranscript,
        },
      });

  return {
    journalEntry,
    wasCreated: !existingEntry,
  };
}

function normalizeLifeAreas(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function normalizeRawTranscript(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeEditedTranscript(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function listJournalEntriesForUser(
  userId: string,
  lifeAreas: string[],
) {
  const prisma = getPrismaClient();
  const entries = await prisma.journalEntry.findMany({
    where: { userId },
    orderBy: [{ entryDate: "asc" }],
    include: {
      sections: {
        orderBy: [{ createdAt: "asc" }],
      },
      tomorrowSetup: true,
    },
  });

  return entries.map((entry) => mapPrismaEntryToDomain(entry, lifeAreas));
}

export async function getJournalEntryForUserByDate(
  userId: string,
  date: string,
  lifeAreas: string[],
) {
  return loadJournalEntryByDate(userId, date, lifeAreas);
}

export async function saveJournalEntryForUser(
  userId: string,
  input: SaveJournalEntryInput,
): Promise<SaveJournalEntryResult> {
  const prisma = getPrismaClient();
  const normalizedSections = normalizeJournalSections(input.sections);
  const normalizedTomorrow = normalizeTomorrowSetup(input.tomorrowSetup);
  const entryDate = parseDateOnly(input.date);
  const createdAt = parseTimestamp(input.createdAt);
  const aiSummaryUpdatedAt = parseTimestamp(input.aiSummaryUpdatedAt);
  const finalizedAt = parseTimestamp(input.finalizedAt);
  const existingEntry = await prisma.journalEntry.findUnique({
    where: {
      userId_entryDate: {
        userId,
        entryDate,
      },
    },
    select: {
      id: true,
    },
  });

  const savedEntry = await prisma.$transaction(async (transaction) => {
    const entry = await transaction.journalEntry.upsert({
      where: {
        userId_entryDate: {
          userId,
          entryDate,
        },
      },
      create: {
        userId,
        entryDate,
        language: normalizeLanguage(input.language),
        rawTranscript: input.rawTranscript,
        editedTranscript: input.editedTranscript,
        aiSummary: input.aiSummary ?? "",
        aiSummaryError: input.aiSummaryError ?? null,
        aiSummaryUpdatedAt,
        finalizedAt,
        completionWebhookSentAt: finalizedAt ?? null,
        ...(createdAt
          ? {
              createdAt,
            }
          : {}),
      },
      update: {
        language: normalizeLanguage(input.language),
        rawTranscript: input.rawTranscript,
        editedTranscript: input.editedTranscript,
        aiSummaryError:
          input.aiSummaryError !== undefined ? input.aiSummaryError : null,
        ...(input.aiSummary !== undefined
          ? {
              aiSummary: input.aiSummary,
            }
          : {}),
        ...(input.aiSummaryUpdatedAt !== undefined
          ? {
              aiSummaryUpdatedAt,
            }
          : {}),
        ...(input.finalizedAt !== undefined
          ? {
              finalizedAt,
              completionWebhookSentAt: finalizedAt ?? undefined,
            }
          : {}),
      },
    });

    await transaction.journalSection.deleteMany({
      where: {
        userId,
        journalEntryId: entry.id,
      },
    });

    const sectionRows = Object.entries(normalizedSections).map(
      ([sectionKey, values]) => ({
        journalEntryId: entry.id,
        userId,
        sectionKey,
        content: values.memo?.trim() ?? "",
      }),
    );

    if (sectionRows.length > 0) {
      await transaction.journalSection.createMany({
        data: sectionRows,
      });
    }

    await transaction.tomorrowSetup.upsert({
      where: {
        journalEntryId_userId: {
          journalEntryId: entry.id,
          userId,
        },
      },
      create: {
        journalEntryId: entry.id,
        userId,
        focus: normalizedTomorrow.mainFocus,
        topTasks: normalizedTomorrow.topTasks,
        watchOutFor: normalizedTomorrow.watchOutFor,
        intention: normalizedTomorrow.intention,
      },
      update: {
        focus: normalizedTomorrow.mainFocus,
        topTasks: normalizedTomorrow.topTasks,
        watchOutFor: normalizedTomorrow.watchOutFor,
        intention: normalizedTomorrow.intention,
      },
    });

    return entry;
  });

  const hydratedEntry = await loadJournalEntryById(savedEntry.id, input.lifeAreas);

  if (!hydratedEntry) {
    throw new Error("Journal could not be loaded after saving.");
  }

  return {
    journalEntry: hydratedEntry,
    wasCreated: !existingEntry,
  };
}

export async function saveJournalSectionForUser(
  userId: string,
  date: string,
  input: SaveJournalSectionInput,
): Promise<SaveJournalEntryResult> {
  const prisma = getPrismaClient();
  const sectionKey = input.sectionKey.trim();

  if (!sectionKey) {
    throw new Error("Use a valid journal section.");
  }

  const entryDate = parseDateOnly(date);
  const savedEntry = await prisma.$transaction(async (transaction) => {
    const { journalEntry, wasCreated } = await ensureJournalEntryRecord(transaction, {
      userId,
      entryDate,
      language: input.language,
      rawTranscript: input.rawTranscript,
      editedTranscript: input.editedTranscript,
    });

    await transaction.journalSection.upsert({
      where: {
        journalEntryId_sectionKey: {
          journalEntryId: journalEntry.id,
          sectionKey,
        },
      },
      create: {
        journalEntryId: journalEntry.id,
        userId,
        sectionKey,
        content: input.content.trim(),
      },
      update: {
        content: input.content.trim(),
      },
    });

    return {
      entryId: journalEntry.id,
      wasCreated,
    };
  });

  const hydratedEntry = await loadJournalEntryById(savedEntry.entryId, input.lifeAreas);

  if (!hydratedEntry) {
    throw new Error("Journal could not be loaded after saving.");
  }

  return {
    journalEntry: hydratedEntry,
    wasCreated: savedEntry.wasCreated,
  };
}

export async function saveTomorrowSetupForUser(
  userId: string,
  date: string,
  input: SaveTomorrowSetupInput,
): Promise<SaveJournalEntryResult> {
  const prisma = getPrismaClient();
  const entryDate = parseDateOnly(date);
  const normalizedTomorrow = normalizeTomorrowSetup(input.tomorrowSetup);

  const savedEntry = await prisma.$transaction(async (transaction) => {
    const { journalEntry, wasCreated } = await ensureJournalEntryRecord(transaction, {
      userId,
      entryDate,
      language: input.language,
      rawTranscript: input.rawTranscript,
      editedTranscript: input.editedTranscript,
    });

    await transaction.tomorrowSetup.upsert({
      where: {
        journalEntryId_userId: {
          journalEntryId: journalEntry.id,
          userId,
        },
      },
      create: {
        journalEntryId: journalEntry.id,
        userId,
        focus: normalizedTomorrow.mainFocus,
        topTasks: normalizedTomorrow.topTasks,
        watchOutFor: normalizedTomorrow.watchOutFor,
        intention: normalizedTomorrow.intention,
      },
      update: {
        focus: normalizedTomorrow.mainFocus,
        topTasks: normalizedTomorrow.topTasks,
        watchOutFor: normalizedTomorrow.watchOutFor,
        intention: normalizedTomorrow.intention,
      },
    });

    return {
      entryId: journalEntry.id,
      wasCreated,
    };
  });

  const hydratedEntry = await loadJournalEntryById(savedEntry.entryId, input.lifeAreas);

  if (!hydratedEntry) {
    throw new Error("Journal could not be loaded after saving.");
  }

  return {
    journalEntry: hydratedEntry,
    wasCreated: savedEntry.wasCreated,
  };
}

export async function updateJournalSummaryForUser(
  userId: string,
  date: string,
  input: UpdateJournalSummaryInput,
) {
  if (input.aiSummary === undefined && input.aiSummaryError === undefined) {
    return null;
  }

  const prisma = getPrismaClient();
  const existingEntry = await prisma.journalEntry.findUnique({
    where: {
      userId_entryDate: {
        userId,
        entryDate: parseDateOnly(date),
      },
    },
  });

  if (!existingEntry) {
    return null;
  }

  const updatedEntry = await prisma.journalEntry.update({
    where: { id: existingEntry.id },
    data: {
      ...(input.aiSummary !== undefined
        ? {
            aiSummary: input.aiSummary,
            aiSummaryUpdatedAt: new Date(),
          }
        : {}),
      ...(input.aiSummaryError !== undefined
        ? {
            aiSummaryError: input.aiSummaryError,
          }
        : {}),
    },
  });

  return loadJournalEntryById(updatedEntry.id, input.lifeAreas);
}

export async function finalizeJournalEntryForUser(
  userId: string,
  date: string,
  input: FinalizeJournalEntryInput,
): Promise<FinalizeJournalEntryResult | null> {
  const prisma = getPrismaClient();
  const entryDate = parseDateOnly(date);
  const existingEntry = await prisma.journalEntry.findUnique({
    where: {
      userId_entryDate: {
        userId,
        entryDate,
      },
    },
    select: {
      id: true,
      finalizedAt: true,
      completionWebhookSentAt: true,
    },
  });

  if (!existingEntry) {
    return null;
  }

  const finalizedAt = existingEntry.finalizedAt ?? new Date();
  const updatedEntry = await prisma.journalEntry.update({
    where: {
      id: existingEntry.id,
    },
    data: {
      aiSummary: input.aiSummary,
      aiSummaryError: null,
      aiSummaryUpdatedAt: new Date(),
      finalizedAt,
    },
  });
  const journalEntry = await loadJournalEntryById(updatedEntry.id, input.lifeAreas);

  if (!journalEntry) {
    throw new Error("Journal summary could not be saved right now.");
  }

  return {
    journalEntry,
    wasJustFinalized: existingEntry.finalizedAt === null,
    shouldTriggerCompletionWebhook: existingEntry.completionWebhookSentAt === null,
  };
}

export async function markJournalCompletionWebhookSentForUser(
  userId: string,
  date: string,
) {
  const prisma = getPrismaClient();
  const existingEntry = await prisma.journalEntry.findUnique({
    where: {
      userId_entryDate: {
        userId,
        entryDate: parseDateOnly(date),
      },
    },
    select: {
      id: true,
      completionWebhookSentAt: true,
    },
  });

  if (!existingEntry || existingEntry.completionWebhookSentAt) {
    return;
  }

  await prisma.journalEntry.update({
    where: {
      id: existingEntry.id,
    },
    data: {
      completionWebhookSentAt: new Date(),
    },
  });
}

export function normalizeJournalEntryPayload(
  body: unknown,
): SaveJournalEntryInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid journal payload.");
  }

  const candidate = body as Record<string, unknown>;
  const date = typeof candidate.date === "string" ? candidate.date : "";
  const rawTranscript =
    typeof candidate.rawTranscript === "string" ? candidate.rawTranscript : "";
  const editedTranscript =
    typeof candidate.editedTranscript === "string" ? candidate.editedTranscript : "";
  const createdAt =
    typeof candidate.createdAt === "string" ? candidate.createdAt : undefined;
  const aiSummary =
    typeof candidate.aiSummary === "string" ? candidate.aiSummary : undefined;
  const aiSummaryError =
    candidate.aiSummaryError === null
      ? null
      : typeof candidate.aiSummaryError === "string"
        ? candidate.aiSummaryError
        : undefined;
  const aiSummaryUpdatedAt =
    typeof candidate.aiSummaryUpdatedAt === "string"
      ? candidate.aiSummaryUpdatedAt
      : undefined;
  const finalizedAt =
    typeof candidate.finalizedAt === "string" ? candidate.finalizedAt : undefined;
  const language = normalizeLanguage(
    typeof candidate.language === "string" ? candidate.language : undefined,
  );
  const lifeAreas = normalizeLifeAreas(candidate.lifeAreas);

  if (!date.trim()) {
    throw new Error("Use a valid journal date.");
  }

  const sections =
    typeof candidate.sections === "object" && candidate.sections !== null
      ? (candidate.sections as JournalEntryInput["sections"])
      : {};
  const tomorrowSetup =
    typeof candidate.tomorrowSetup === "object" && candidate.tomorrowSetup !== null
      ? (candidate.tomorrowSetup as TomorrowSetup)
      : emptyTomorrowSetup;

  return {
    date,
    sections: normalizeJournalSections(sections),
    rawTranscript,
    editedTranscript,
    tomorrowSetup: normalizeTomorrowSetup(tomorrowSetup),
    language,
    lifeAreas,
    createdAt,
    aiSummary,
    aiSummaryError,
    aiSummaryUpdatedAt,
    finalizedAt,
  };
}

export function normalizeJournalSectionPayload(
  body: unknown,
  sectionKey: string,
): SaveJournalSectionInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid journal section payload.");
  }

  const candidate = body as Record<string, unknown>;

  return {
    sectionKey,
    content: typeof candidate.content === "string" ? candidate.content : "",
    rawTranscript: normalizeRawTranscript(candidate.rawTranscript),
    editedTranscript: normalizeEditedTranscript(candidate.editedTranscript),
    language: normalizeLanguage(
      typeof candidate.language === "string" ? candidate.language : undefined,
    ),
    lifeAreas: normalizeLifeAreas(candidate.lifeAreas),
  };
}

export function normalizeTomorrowSetupPayload(
  body: unknown,
): SaveTomorrowSetupInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid tomorrow setup payload.");
  }

  const candidate = body as Record<string, unknown>;
  const tomorrowSetup =
    typeof candidate.tomorrowSetup === "object" && candidate.tomorrowSetup !== null
      ? (candidate.tomorrowSetup as TomorrowSetup)
      : emptyTomorrowSetup;

  return {
    rawTranscript: normalizeRawTranscript(candidate.rawTranscript),
    editedTranscript: normalizeEditedTranscript(candidate.editedTranscript),
    tomorrowSetup: normalizeTomorrowSetup(tomorrowSetup),
    language: normalizeLanguage(
      typeof candidate.language === "string" ? candidate.language : undefined,
    ),
    lifeAreas: normalizeLifeAreas(candidate.lifeAreas),
  };
}

export function normalizeJournalFinalizePayload(
  body: unknown,
): FinalizeJournalEntryPayload {
  if (body === undefined || body === null) {
    return {
      lifeAreas: [],
    };
  }

  if (typeof body !== "object") {
    throw new Error("Use a valid journal finalize payload.");
  }

  const candidate = body as Record<string, unknown>;

  return {
    lifeAreas: normalizeLifeAreas(candidate.lifeAreas),
  };
}

export function normalizeJournalSummaryPayload(
  body: unknown,
): UpdateJournalSummaryInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid journal summary payload.");
  }

  const candidate = body as Record<string, unknown>;
  const lifeAreas = Array.isArray(candidate.lifeAreas)
    ? candidate.lifeAreas.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];
  const update: UpdateJournalSummaryInput = {
    lifeAreas,
  };

  if (candidate.aiSummary !== undefined) {
    if (typeof candidate.aiSummary !== "string") {
      throw new Error("Use a valid journal summary.");
    }
    update.aiSummary = candidate.aiSummary;
  }

  if (candidate.aiSummaryError !== undefined) {
    if (
      candidate.aiSummaryError !== null &&
      typeof candidate.aiSummaryError !== "string"
    ) {
      throw new Error("Use a valid journal summary error.");
    }
    update.aiSummaryError = candidate.aiSummaryError;
  }

  return update;
}
