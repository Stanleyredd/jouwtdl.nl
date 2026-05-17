import { getCurrentUser } from "@/lib/auth";
import {
  ensureProfileForUser,
  saveProfileForUser,
} from "@/services/profile-repository";
import type { JournalConfig, JournalPreset } from "@/types";

export const runtime = "nodejs";

function logProfileApi(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug("[profile-api]", event, payload);
  console.debug("[profile-api]", `${event}:details`, JSON.stringify(payload, null, 2));
}

async function getAuthedUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: Response.json(
        { error: "You need to log in before using profile settings." },
        { status: 401 },
      ),
      user: null,
    };
  }

  return {
    error: null,
    user,
  };
}

export async function GET() {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  const { user } = context;
  logProfileApi("profile-load-started", {
    userId: user.id,
  });

  try {
    const profile = await ensureProfileForUser(user);

    logProfileApi("profile-load-succeeded", {
      userId: user.id,
      onboardingCompleted: profile.onboardingCompleted,
      journalPreset: profile.journalPreset,
      hasJournalConfig: Boolean(profile.journalConfig),
    });

    return Response.json({ profile });
  } catch (error) {
    console.error("[profile-api]", "profile-load-failed", {
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown profile load failure.",
    });

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Your profile could not be loaded right now.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const context = await getAuthedUser();

  if (context.error) {
    return context.error;
  }

  const { user } = context;
  const body = (await request.json().catch(() => ({}))) as {
    onboardingCompleted?: boolean;
    journalPreset?: JournalPreset | null;
    journalConfig?: JournalConfig | null;
  };

  logProfileApi("profile-save-started", {
    userId: user.id,
    payloadKeys: Object.keys(body),
  });

  try {
    const profile = await saveProfileForUser(user, {
      onboardingCompleted:
        typeof body.onboardingCompleted === "boolean"
          ? body.onboardingCompleted
          : undefined,
      journalPreset:
        typeof body.journalPreset === "string" || body.journalPreset === null
          ? body.journalPreset
          : undefined,
      journalConfig:
        body.journalConfig && typeof body.journalConfig === "object"
          ? body.journalConfig
          : body.journalConfig === null
            ? null
            : undefined,
    });

    logProfileApi("profile-save-succeeded", {
      userId: user.id,
      onboardingCompleted: profile.onboardingCompleted,
      journalPreset: profile.journalPreset,
      hasJournalConfig: Boolean(profile.journalConfig),
    });

    return Response.json({ profile });
  } catch (error) {
    console.error("[profile-api]", "profile-save-failed", {
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown profile save failure.",
    });

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Your profile could not be saved right now.",
      },
      { status: 500 },
    );
  }
}
