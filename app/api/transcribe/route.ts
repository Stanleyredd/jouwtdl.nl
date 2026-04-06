import OpenAI from "openai";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/shared";

const TRANSCRIPTION_MODEL = "gpt-4o-transcribe";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error: "Voice transcription is not configured yet. Add OPENAI_API_KEY to .env.local.",
      },
      { status: 500 },
    );
  }

  try {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return Response.json(
          {
            error: "You need to log in before using voice transcription.",
          },
          { status: 401 },
        );
      }
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    const language = normalizeLanguage(formData.get("language"));

    if (!(audio instanceof File)) {
      return Response.json({ error: "No audio file was uploaded." }, { status: 400 });
    }

    if (audio.size === 0) {
      return Response.json({ error: "The recording was empty." }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json(
        { error: "This recording is too large. Keep it under about 2 minutes." },
        { status: 413 },
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: TRANSCRIPTION_MODEL,
      language,
      prompt: buildPrompt(language),
      response_format: "json",
    });

    const transcript = transcription.text.trim();

    if (!transcript) {
      return Response.json(
        { error: "No transcript was returned. Try recording again." },
        { status: 502 },
      );
    }

    return Response.json({ transcript });
  } catch (caughtError) {
    console.error("[transcribe]", caughtError);

    return Response.json(
      {
        error: "Transcription failed. Try again or type manually.",
      },
      { status: 500 },
    );
  }
}

function normalizeLanguage(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "nl";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "nl-nl") {
    return "nl";
  }

  return normalized || "nl";
}

function buildPrompt(language: string) {
  if (language === "nl") {
    return "Dit is een Nederlandse dagboekreflectie. Transcribeer natuurlijk, duidelijk en met gewone interpunctie.";
  }

  return "Transcribe this journal reflection clearly and naturally.";
}
