import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/shared";
import {
  ensureProfileForUser,
  updateProfileForUser,
} from "@/services/profile-service";
import type { JournalConfig, JournalPreset } from "@/types";

export const runtime = "nodejs";

function logProfileApi(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug("[profile-api]", event, payload);
}

async function getAuthedProfileContext() {
  if (!isSupabaseConfigured()) {
    return {
      error: Response.json(
        {
          error:
            "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
        },
        { status: 500 },
      ),
      supabase: null,
      user: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[profile-api]", "profile-auth-failed", {
        code: error.code,
        message: error.message,
        name: error.name,
        status: error.status,
      });
    }

    return {
      error: Response.json(
        { error: "Your profile could not be loaded right now." },
        { status: 500 },
      ),
      supabase: null,
      user: null,
    };
  }

  if (!user) {
    return {
      error: Response.json(
        { error: "You need to log in before using profile settings." },
        { status: 401 },
      ),
      supabase,
      user: null,
    };
  }

  return {
    error: null,
    supabase,
    user,
  };
}

export async function GET() {
  const context = await getAuthedProfileContext();

  if (context.error) {
    return context.error;
  }

  const { supabase, user } = context;
  logProfileApi("profile-load-started", {
    userId: user.id,
  });

  try {
    const profile = await ensureProfileForUser(supabase, user);

    logProfileApi("profile-load-succeeded", {
      userId: user.id,
      onboardingCompleted: profile.onboardingCompleted,
      journalPreset: profile.journalPreset,
      hasJournalConfig: Boolean(profile.journalConfig),
    });

    return Response.json({ profile });
  } catch (caughtError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[profile-api]", "profile-load-failed", {
        userId: user.id,
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Unknown profile load failure.",
      });
    }

    return Response.json(
      {
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Your profile could not be loaded right now.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const context = await getAuthedProfileContext();

  if (context.error) {
    return context.error;
  }

  const { supabase, user } = context;
  const body = (await request.json().catch(() => ({}))) as {
    onboardingCompleted?: boolean;
    journalPreset?: JournalPreset | null;
    journalConfig?: JournalConfig | null;
  };

  logProfileApi("profile-save-started", {
    userId: user.id,
    body,
  });

  try {
    const profile = await updateProfileForUser(supabase, user, {
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
  } catch (caughtError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[profile-api]", "profile-save-failed", {
        userId: user.id,
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Unknown profile save failure.",
      });
    }

    return Response.json(
      {
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Your profile could not be saved right now.",
      },
      { status: 500 },
    );
  }
}
