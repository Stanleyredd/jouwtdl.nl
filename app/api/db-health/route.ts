import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      ok: true,
      database: "reachable",
      provider: "postgresql",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database connection failed.";

    return Response.json(
      {
        ok: false,
        database: "unreachable",
        provider: "postgresql",
        error: message,
      },
      { status: 500 },
    );
  }
}
