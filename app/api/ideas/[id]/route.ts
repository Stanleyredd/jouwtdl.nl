import {
  deleteIdeaForUser, getIdeaForUser, updateIdeaForUser,
} from "@/services/idea-entry-repository";
import {
  ideaNotFound, invalidIdeaPayload, isIdeaId, readIdeaFields, withIdeaUser,
} from "@/services/idea-entry-route-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: RouteContext<"/api/ideas/[id]">) {
  return withIdeaUser(async (userId) => {
    const { id } = await params;
    if (!isIdeaId(id)) return ideaNotFound();
    const idea = await getIdeaForUser(userId, id);
    return idea ? Response.json({ idea }) : ideaNotFound();
  });
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/ideas/[id]">) {
  return withIdeaUser(async (userId) => {
    const { id } = await params;
    if (!isIdeaId(id)) return ideaNotFound();
    const fields = await readIdeaFields(request, false);
    if (!fields) return invalidIdeaPayload();
    const idea = await updateIdeaForUser(userId, id, fields);
    return idea ? Response.json({ idea }) : ideaNotFound();
  });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/ideas/[id]">) {
  return withIdeaUser(async (userId) => {
    const { id } = await params;
    if (!isIdeaId(id)) return ideaNotFound();
    return (await deleteIdeaForUser(userId, id))
      ? new Response(null, { status: 204 })
      : ideaNotFound();
  });
}
