import "server-only";

import { type DreamEntry as PrismaDreamEntry } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";
import type { DreamEntry, DreamSource } from "@/types";

const dreamSources = new Set<DreamSource>(["voice", "text"]);

export interface CreateDreamEntryInput {
  title?: string;
  content: string;
  dreamDate: string;
  source?: DreamSource;
}

export interface UpdateDreamEntryInput {
  title?: string;
  content?: string;
  dreamDate?: string;
  source?: DreamSource;
}

function parseDateOnly(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Use a valid dream date.");
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function normalizeOptionalTitle(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeRequiredContent(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Dream content cannot be empty.");
  }

  return normalized;
}

function normalizeSource(value: DreamSource | undefined) {
  if (!value) {
    return "text" satisfies DreamSource;
  }

  if (!dreamSources.has(value)) {
    throw new Error("Use a valid dream source.");
  }

  return value;
}

function mapPrismaDreamEntry(entry: PrismaDreamEntry): DreamEntry {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    dreamDate: entry.dreamDate.toISOString().slice(0, 10),
    source: entry.source as DreamSource,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function assertOwnedDreamEntry(entry: PrismaDreamEntry | null, userId: string) {
  if (!entry || entry.userId !== userId) {
    throw new Error("Dream not found.");
  }

  return entry;
}

export async function listDreamEntriesForUser(userId: string) {
  const prisma = getPrismaClient();
  const dreams = await prisma.dreamEntry.findMany({
    where: { userId },
    orderBy: [
      { dreamDate: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  return dreams.map(mapPrismaDreamEntry);
}

export async function getDreamEntryForUser(userId: string, dreamId: string) {
  const prisma = getPrismaClient();
  const dream = await prisma.dreamEntry.findUnique({
    where: { id: dreamId },
  });

  return mapPrismaDreamEntry(assertOwnedDreamEntry(dream, userId));
}

export async function createDreamEntryForUser(
  userId: string,
  input: CreateDreamEntryInput,
) {
  const prisma = getPrismaClient();
  const createdDream = await prisma.dreamEntry.create({
    data: {
      userId,
      title: normalizeOptionalTitle(input.title),
      content: normalizeRequiredContent(input.content),
      dreamDate: parseDateOnly(input.dreamDate),
      source: normalizeSource(input.source),
    },
  });

  return mapPrismaDreamEntry(createdDream);
}

export async function updateDreamEntryForUser(
  userId: string,
  dreamId: string,
  input: UpdateDreamEntryInput,
) {
  const prisma = getPrismaClient();
  const existingDream = await prisma.dreamEntry.findUnique({
    where: { id: dreamId },
  });

  assertOwnedDreamEntry(existingDream, userId);

  const updateData: {
    title?: string;
    content?: string;
    dreamDate?: Date;
    source?: DreamSource;
  } = {};

  if (input.title !== undefined) {
    updateData.title = normalizeOptionalTitle(input.title);
  }

  if (input.content !== undefined) {
    updateData.content = normalizeRequiredContent(input.content);
  }

  if (input.dreamDate !== undefined) {
    updateData.dreamDate = parseDateOnly(input.dreamDate);
  }

  if (input.source !== undefined) {
    updateData.source = normalizeSource(input.source);
  }

  const updatedDream = await prisma.dreamEntry.update({
    where: { id: dreamId },
    data: updateData,
  });

  return mapPrismaDreamEntry(updatedDream);
}

export async function deleteDreamEntryForUser(userId: string, dreamId: string) {
  const prisma = getPrismaClient();
  const existingDream = await prisma.dreamEntry.findUnique({
    where: { id: dreamId },
  });

  assertOwnedDreamEntry(existingDream, userId);

  await prisma.dreamEntry.delete({
    where: { id: dreamId },
  });
}

export function normalizeDreamEntryCreatePayload(body: unknown): CreateDreamEntryInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid dream payload.");
  }

  const candidate = body as Record<string, unknown>;
  const title = typeof candidate.title === "string" ? candidate.title : undefined;
  const content = typeof candidate.content === "string" ? candidate.content : "";
  const dreamDate =
    typeof candidate.dreamDate === "string" ? candidate.dreamDate : "";
  const source =
    typeof candidate.source === "string" ? (candidate.source as DreamSource) : undefined;

  if (!dreamDate.trim()) {
    throw new Error("Dream date is required.");
  }

  return {
    title,
    content,
    dreamDate,
    source,
  };
}

export function normalizeDreamEntryUpdatePayload(body: unknown): UpdateDreamEntryInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Use a valid dream payload.");
  }

  const candidate = body as Record<string, unknown>;
  const input: UpdateDreamEntryInput = {};

  if (typeof candidate.title === "string") {
    input.title = candidate.title;
  }

  if (typeof candidate.content === "string") {
    input.content = candidate.content;
  }

  if (typeof candidate.dreamDate === "string") {
    input.dreamDate = candidate.dreamDate;
  }

  if (typeof candidate.source === "string") {
    input.source = candidate.source as DreamSource;
  }

  if (Object.keys(input).length === 0) {
    throw new Error("Use a valid dream payload.");
  }

  return input;
}
