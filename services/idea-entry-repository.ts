import "server-only";

import type { IdeaEntry as IdeaRow } from "@prisma/client";

import type { IdeaFields } from "@/lib/ideas";
import { getPrismaClient } from "@/lib/prisma";

type CreateIdea = Pick<IdeaFields, "title" | "content"> &
  Partial<Pick<IdeaFields, "category" | "priority">>;

function toIdea({ id, title, content, category, status, priority, createdAt, updatedAt }: IdeaRow) {
  return {
    id, title, content, category, status, priority,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function ownedIdea(userId: string, id: string) {
  return { id_userId: { id, userId } };
}

export async function listIdeasForUser(userId: string) {
  const rows = await getPrismaClient().ideaEntry.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toIdea);
}

export async function getIdeaForUser(userId: string, id: string) {
  const row = await getPrismaClient().ideaEntry.findUnique({ where: ownedIdea(userId, id) });
  return row ? toIdea(row) : null;
}

export async function createIdeaForUser(userId: string, input: CreateIdea) {
  return toIdea(await getPrismaClient().ideaEntry.create({ data: { ...input, userId } }));
}

export async function updateIdeaForUser(userId: string, id: string, input: Partial<IdeaFields>) {
  const [row] = await getPrismaClient().ideaEntry.updateManyAndReturn({
    where: { id, userId },
    data: input,
  });
  return row ? toIdea(row) : null;
}

export async function deleteIdeaForUser(userId: string, id: string) {
  const { count } = await getPrismaClient().ideaEntry.deleteMany({ where: { id, userId } });
  return count === 1;
}
