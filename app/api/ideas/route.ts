import { createIdeaForUser, listIdeasForUser } from "@/services/idea-entry-repository";
import { invalidIdeaPayload, readIdeaFields, withIdeaUser } from "@/services/idea-entry-route-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withIdeaUser(async (userId) =>
    Response.json({ ideas: await listIdeasForUser(userId) }),
  );
}

export async function POST(request: Request) {
  return withIdeaUser(async (userId) => {
    const fields = await readIdeaFields(request, true);
    if (!fields?.title || !fields.content) return invalidIdeaPayload();

    const { title, content, category, priority } = fields;
    const idea = await createIdeaForUser(userId, { title, content, category, priority });
    return Response.json({ idea }, { status: 201 });
  });
}
