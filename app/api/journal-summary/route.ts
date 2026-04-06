import OpenAI from "openai";
import type { ResponseFormatTextJSONSchemaConfig } from "openai/resources/responses/responses";

import {
  buildStructuredJournalText,
  normalizeJournalSections,
} from "@/data/journal-template";
import {
  getEnabledJournalConfigSections,
  normalizeJournalConfig,
} from "@/lib/journal-config";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/shared";
import type { JournalConfig, JournalSections, TomorrowSetup } from "@/types";

const SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL || "gpt-5-mini";
const DUTCH_SECTION_HEADINGS = [
  "📅 Dag samenvatting",
  "📉 Trading & markt",
  "💼 Werk & business",
  "⚡ Energie & gevoel",
  "🎯 Focus voor morgen",
] as const;
const ENGLISH_SECTION_HEADINGS = [
  "📅 Day recap",
  "📉 Trading & market",
  "💼 Work & business",
  "⚡ Energy & mood",
  "🎯 Focus for tomorrow",
] as const;
const SUMMARY_FORMAT: ResponseFormatTextJSONSchemaConfig = {
  type: "json_schema",
  name: "journal_summary",
  strict: true,
  description: "A concise structured journal summary.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary"],
    properties: {
      summary: {
        type: "string",
        description:
          "A concise, practical daily summary in three short sections.",
      },
    },
  },
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error: "Journal summary is not configured yet. Add OPENAI_API_KEY to .env.local.",
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
            error: "You need to log in before generating a journal summary.",
          },
          { status: 401 },
        );
      }
    }

    const body = (await request.json()) as {
      date?: string;
      sections?: JournalSections;
      tomorrowSetup?: TomorrowSetup;
      language?: AppLanguage;
      journalConfig?: JournalConfig;
    };

    const date = typeof body.date === "string" ? body.date : "";
    const language = normalizeLanguage(body.language);
    const journalConfig = normalizeJournalConfig(body.journalConfig, language);
    const sections = normalizeJournalSections(body.sections, journalConfig);
    const journalText = buildStructuredJournalText(sections, journalConfig);
    const sectionTitles = getEnabledJournalConfigSections(journalConfig).map(
      (section) => section.title,
    );

    if (process.env.NODE_ENV === "development") {
      console.debug("[journal-summary]", "summary-request-started", {
        date,
        language,
      });
    }

    if (!date) {
      return Response.json({ error: "A journal date is required." }, { status: 400 });
    }

    if (!journalText) {
      return Response.json(
        { error: "Write a little more before generating a summary." },
        { status: 400 },
      );
    }

    const tomorrowSetup = normalizeTomorrowSetup(body.tomorrowSetup);
    const prompt = buildSummaryPrompt(
      date,
      journalText,
      tomorrowSetup,
      language,
      journalConfig,
    );

    if (process.env.NODE_ENV === "development") {
      console.debug("[journal-summary]", "summary-payload-built", {
        date,
        language,
        prompt,
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let summary = "";
    let quality = { isValid: false, reasons: ["empty"] };

    for (const attempt of [
      { key: "primary", strictRetry: false },
      { key: "retry", strictRetry: true },
    ] as const) {
      const response = await requestModelSummary({
        client,
        prompt,
        language,
        strictRetry: attempt.strictRetry,
      });

      if (process.env.NODE_ENV === "development") {
        console.debug("[journal-summary]", "raw-summary-response-received", {
          attempt: attempt.key,
          output_parsed: response.output_parsed,
          output_text: response.output_text,
          output: response.output,
          error: response.error,
          incomplete_details: response.incomplete_details,
        });
        console.debug("[journal-summary]", "raw-model-response", {
          attempt: attempt.key,
          output_parsed: response.output_parsed,
          output_text: response.output_text,
          output: response.output,
          error: response.error,
          incomplete_details: response.incomplete_details,
        });
      }

      const candidate = normalizeSummary(extractSummary(response));
      quality = evaluateSummaryQuality(candidate, {
        journalText,
        language,
        sectionTitles,
      });

      if (process.env.NODE_ENV === "development") {
        console.debug("[journal-summary]", "normalized-summary", {
          attempt: attempt.key,
          source: "model",
          summary: candidate,
          quality,
        });
      }

      if (quality.isValid) {
        summary = candidate;
        break;
      }

      if (process.env.NODE_ENV === "development") {
        console.warn("[journal-summary]", "summary-route-failure", {
          attempt: attempt.key,
          reason: "Summary quality rejected.",
          quality,
          candidate,
        });
      }
    }

    if (!summary) {
      const fallbackSummary = normalizeSummary(
        buildFallbackSummary({
          sections,
          tomorrowSetup,
          language,
          journalConfig,
        }),
      );

      if (process.env.NODE_ENV === "development") {
        console.debug("[journal-summary]", "normalized-summary", {
          source: "fallback",
          summary: fallbackSummary,
          quality: evaluateSummaryQuality(fallbackSummary, {
            journalText,
            language,
            sectionTitles,
          }),
        });
      }

      if (fallbackSummary) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[journal-summary]", "summary-route-success", {
            source: "fallback",
            summary: fallbackSummary,
          });
        }

        return Response.json({ summary: fallbackSummary });
      }

      if (process.env.NODE_ENV === "development") {
        console.debug("[journal-summary]", "parsed-summary", {
          summary: null,
        });
        console.error("[journal-summary]", "summary-route-failure", {
          reason: "No usable summary could be extracted or generated.",
          quality,
        });
      }
      return Response.json(
        {
          error:
            language === "nl"
              ? "Er kwam geen samenvatting terug. Je journal is wel opgeslagen."
              : "No summary was returned. Your journal is still saved.",
        },
        { status: 502 },
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.debug("[journal-summary]", "parsed-summary", {
        summary,
      });
      console.debug("[journal-summary]", "summary-route-success", {
        source: "model",
        summary,
      });
    }

    return Response.json({ summary });
  } catch (caughtError) {
    console.error("[journal-summary]", caughtError);
    if (process.env.NODE_ENV === "development") {
      console.error("[journal-summary]", "summary-route-failure", {
        reason:
          caughtError instanceof Error
            ? caughtError.message
            : "Unexpected summary route error.",
      });
    }

    return Response.json(
      {
        error: "Summary could not be generated right now. Your journal is still saved.",
      },
      { status: 500 },
    );
  }
}

async function requestModelSummary({
  client,
  prompt,
  language,
  strictRetry,
}: {
  client: OpenAI;
  prompt: string;
  language: AppLanguage;
  strictRetry: boolean;
}) {
  const instructions = buildSummaryInstructions(language, strictRetry);

  if (process.env.NODE_ENV === "development") {
    console.debug("[journal-summary]", "summary-api-called", {
      model: SUMMARY_MODEL,
      format: SUMMARY_FORMAT,
      strictRetry,
    });
  }

  return client.responses.parse({
    model: SUMMARY_MODEL,
    max_output_tokens: strictRetry ? 420 : 360,
    instructions,
    input: prompt,
    text: {
      format: SUMMARY_FORMAT,
    },
  });
}

function buildSummaryInstructions(language: AppLanguage, strictRetry: boolean) {
  if (language === "nl") {
    return strictRetry
      ? [
          "Je schrijft een natuurlijke Nederlandse dagsamenvatting op basis van alle journalonderdelen samen.",
          "Doel: één bruikbare, rustige recap van de hele dag.",
          "Gebruik exact dit leesbare format met witregels ertussen: '📅 Dag samenvatting', daarna optioneel alleen relevante secties uit '📉 Trading & markt', '💼 Werk & business', '⚡ Energie & gevoel', '🎯 Focus voor morgen'.",
          "Elke sectie krijgt een korte alinea van 1 tot 3 zinnen. De hele samenvatting blijft compact maar inhoudelijk genoeg om echt nuttig te zijn.",
          "Schrijf vloeiend en menselijk Nederlands. Geen bullets. Geen losse fragmenten. Geen sectietitels uit het journal kopiëren. Geen halve zinnen. Geen dense tekstmuur.",
          "Vat de belangrijkste thema's samen: marktcontext, trading-resultaat en les, werk of belangrijke gebeurtenissen, energie of emotionele staat, en een praktische richting voor morgen.",
          "Als een onderdeel niet relevant is, laat die sectie weg. Forceer geen lege secties.",
          "Geef alleen geldige JSON terug die exact past bij het schema.",
        ].join(" ")
      : [
          "Je vat een persoonlijke journal-entry samen tot één natuurlijke Nederlandse dagrecap.",
          "Gebruik een rustige, scanbare opmaak met witregels.",
          "Begin altijd met '📅 Dag samenvatting'. Voeg daarna alleen relevante secties toe uit '📉 Trading & markt', '💼 Werk & business', '⚡ Energie & gevoel', '🎯 Focus voor morgen'.",
          "Schrijf per sectie een korte alinea van 1 tot 3 zinnen. De totale recap mag compact blijven, maar moet wel echt de dag samenvatten.",
          "Neem de belangrijkste thema's mee: marktcontext, trades en les, relevante werk- of daggebeurtenissen, emotionele of power-staat, en richting voor morgen.",
          "Gebruik een praktische, warme toon. Geen bullets. Geen losse labels of fragmenten. Geen sectietitels uit het journal letterlijk overnemen.",
          "Geef alleen geldige JSON terug die exact past bij het schema.",
        ].join(" ");
  }

  return strictRetry
    ? [
        "Write a natural English daily recap based on all journal sections together.",
        "Goal: one useful, calm recap of the full day.",
        "Use exactly this readable format with blank lines between sections: '📅 Day recap', then optionally only the relevant sections from '📉 Trading & market', '💼 Work & business', '⚡ Energy & mood', '🎯 Focus for tomorrow'.",
        "Each section should have a short paragraph of 1 to 3 sentences. Keep the whole recap compact but genuinely useful.",
        "Sound human and cohesive. No bullet points. No stitched fragments. No raw labels. Do not copy journal section titles literally.",
        "Cover the most important themes: market context, trade result and lesson, work or meaningful events, emotional or power state, and a practical direction for tomorrow.",
        "If a section is not relevant, omit it instead of forcing it.",
        "Return only valid JSON that exactly matches the schema.",
      ].join(" ")
    : [
        "Turn the full journal entry into one natural English daily recap.",
        "Use calm, readable formatting with blank lines.",
        "Start with '📅 Day recap'. Then add only relevant sections from '📉 Trading & market', '💼 Work & business', '⚡ Energy & mood', '🎯 Focus for tomorrow'.",
        "Write a short paragraph for each included section. Keep it compact, readable, and meaningful.",
        "Summarize the full day, not isolated fragments. Use a practical, warm tone. No bullet points. Do not copy journal section titles literally.",
        "Return only valid JSON that exactly matches the schema.",
      ].join(" ");
}

function buildSummaryPrompt(
  date: string,
  journalText: string,
  tomorrowSetup: TomorrowSetup,
  language: AppLanguage,
  journalConfig: JournalConfig,
) {
  const mainFocusLabel =
    language === "nl" ? "Focus voor morgen" : "Main focus";
  const topTasksLabel = language === "nl" ? "Top taken" : "Top tasks";
  const watchLabel = language === "nl" ? "Let op" : "Watch out for";
  const intentionLabel = language === "nl" ? "Intentie" : "Intention";
  const dateLabel = language === "nl" ? "Datum" : "Date";
  const journalNotesLabel = language === "nl" ? "Journalnotities" : "Journal notes";
  const tomorrowSetupLabel = language === "nl" ? "Voor morgen" : "Tomorrow setup";
  const configuredSectionsLabel =
    language === "nl" ? "Actieve journalsecties" : "Active journal sections";
  const configuredSections = getEnabledJournalConfigSections(journalConfig)
    .map(
      (section) =>
        `${section.title}${section.description ? ` — ${section.description}` : ""}`,
    )
    .join("\n");

  return [
    `${dateLabel}: ${date}`,
    "",
    `${configuredSectionsLabel}:`,
    configuredSections || "-",
    "",
    `${journalNotesLabel}:`,
    journalText,
    "",
    `${tomorrowSetupLabel}:`,
    `${mainFocusLabel}: ${tomorrowSetup.mainFocus || "-"}`,
    `${topTasksLabel}: ${
      tomorrowSetup.topTasks.filter(Boolean).join(" | ") || "-"
    }`,
    `${watchLabel}: ${tomorrowSetup.watchOutFor || "-"}`,
    `${intentionLabel}: ${tomorrowSetup.intention || "-"}`,
  ].join("\n");
}

function normalizeTomorrowSetup(value: TomorrowSetup | undefined): TomorrowSetup {
  return {
    mainFocus: value?.mainFocus ?? "",
    topTasks: Array.isArray(value?.topTasks) ? value.topTasks : [],
    watchOutFor: value?.watchOutFor ?? "",
    intention: value?.intention ?? "",
  };
}

function extractSummary(response: {
  output_parsed?: unknown;
  output_text?: string | null;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      parsed?: unknown;
    }>;
  }>;
}) {
  if (process.env.NODE_ENV === "development") {
    console.debug("[journal-summary]", "summary-extraction-attempt-1", {
      output_parsed: response.output_parsed,
    });
  }

  const parsedFromStructured = getSummaryFromParsed(response.output_parsed);
  if (parsedFromStructured) {
    logSummaryCandidate("output_parsed", parsedFromStructured);
    return parsedFromStructured;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[journal-summary]", "summary-extraction-attempt-2", {
      output_text: response.output_text,
      output: response.output,
    });
  }

  const parsedFromText = parseSummaryJson(response.output_text);
  if (parsedFromText) {
    logSummaryCandidate("output_text.json", parsedFromText);
    return parsedFromText;
  }

  const parsedFromOutputItems = extractSummaryFromOutputItems(response.output);
  if (parsedFromOutputItems) {
    return parsedFromOutputItems;
  }

  const directOutputText = normalizeSummary(response.output_text ?? "");
  if (directOutputText) {
    logSummaryCandidate("output_text.plain", directOutputText);
    return directOutputText;
  }

  return "";
}

function getSummaryFromParsed(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const summary =
    "summary" in value && typeof value.summary === "string"
      ? value.summary.trim()
      : "";

  return summary;
}

function parseSummaryJson(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed) as { summary?: unknown };
    return typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  } catch {
    return "";
  }
}

function extractSummaryFromOutputItems(
  output:
    | Array<{
        type?: string;
        content?: Array<{
          type?: string;
          text?: string;
          parsed?: unknown;
        }>;
      }>
    | undefined,
) {
  const contentItems =
    output?.flatMap((item) => (item.type === "message" ? item.content ?? [] : [])) ?? [];

  for (const content of contentItems) {
    const parsedCandidate = getSummaryFromParsed(content.parsed);
    if (parsedCandidate) {
      logSummaryCandidate("output.content.parsed", parsedCandidate);
      return parsedCandidate;
    }

    const jsonCandidate = parseSummaryJson(content.text);
    if (jsonCandidate) {
      logSummaryCandidate("output.content.json", jsonCandidate);
      return jsonCandidate;
    }

    const textCandidate = normalizeSummary(content.text ?? "");
    if (textCandidate) {
      logSummaryCandidate("output.content.plain", textCandidate);
      return textCandidate;
    }
  }

  return "";
}

function normalizeSummary(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function buildFallbackSummary({
  sections,
  tomorrowSetup,
  language,
  journalConfig,
}: {
  sections: JournalSections;
  tomorrowSetup: TomorrowSetup;
  language: AppLanguage;
  journalConfig: JournalConfig;
}) {
  const enabledSections = getEnabledJournalConfigSections(journalConfig);
  const sectionEntries = enabledSections
    .map((section) => ({
      ...section,
      memo: summarizeLine(sections[section.id]?.memo ?? ""),
    }))
    .filter((section) => section.memo);
  const combinedSectionsText = sectionEntries.map((section) => section.memo).join(" ");
  const market = summarizeLine(
    sectionEntries
      .filter((section) =>
        matchesSectionCategory(section, [
          "market",
          "markt",
          "bitcoin",
          "chart",
          "ema",
          "price",
        ]),
      )
      .map((section) => section.memo)
      .join(" "),
  );
  const trades = summarizeLine(
    sectionEntries
      .filter((section) =>
        matchesSectionCategory(section, [
          "trade",
          "trades",
          "entry",
          "exit",
          "stoploss",
          "position",
          "positie",
        ]),
      )
      .map((section) => section.memo)
      .join(" "),
  );
  const trends = summarizeLine(
    sectionEntries
      .filter((section) =>
        matchesSectionCategory(section, [
          "trend",
          "macro",
          "news",
          "nieuws",
          "sentiment",
          "context",
          "narrative",
        ]),
      )
      .map((section) => section.memo)
      .join(" "),
  );
  const work = summarizeLine(
    sectionEntries
      .filter((section) =>
        matchesSectionCategory(section, [
          "work",
          "business",
          "project",
          "conversation",
          "client",
        ]),
      )
      .map((section) => section.memo)
      .join(" "),
  );
  const energy = summarizeLine(
    sectionEntries
      .filter((section) =>
        matchesSectionCategory(section, [
          "power",
          "energy",
          "mood",
          "focus",
          "health",
          "energie",
          "stemming",
          "gevoel",
        ]),
      )
      .map((section) => section.memo)
      .join(" "),
  );
  const sentence =
    summarizeLine(
      sectionEntries.find((section) => section.id.includes("summary"))?.memo ?? "",
    ) || summarizeLine(sectionEntries[0]?.memo ?? "");
  const endOfDay = summarizeLine(combinedSectionsText);
  const tomorrowTasks = tomorrowSetup.topTasks.filter(Boolean).slice(0, 2).join(", ");

  const title = language === "nl" ? "📅 Dag samenvatting" : "📅 Day recap";
  const tradingHeading =
    language === "nl" ? "📉 Trading & markt" : "📉 Trading & market";
  const workHeading =
    language === "nl" ? "💼 Werk & business" : "💼 Work & business";
  const energyHeading =
    language === "nl" ? "⚡ Energie & gevoel" : "⚡ Energy & mood";
  const tomorrowHeading =
    language === "nl" ? "🎯 Focus voor morgen" : "🎯 Focus for tomorrow";

  const parts: string[] = [title];

  const intro = language === "nl"
    ? [
        sentence
          ? `Het was vooral een dag waarin ${lowercaseFirst(sentence)}.`
          : "",
        endOfDay
          ? `In grote lijnen bleek dat ${lowercaseFirst(endOfDay)}.`
          : "",
      ]
        .filter(Boolean)
        .slice(0, 2)
        .join(" ")
    : [
        sentence ? `Overall, it was a day where ${lowercaseFirst(sentence)}.` : "",
        endOfDay ? `In broad terms, it became clear that ${lowercaseFirst(endOfDay)}.` : "",
      ]
        .filter(Boolean)
        .slice(0, 2)
        .join(" ");

  if (intro) {
    parts.push("", intro);
  }

  const tradingText = language === "nl"
    ? [
        market ? `De marktcontext draaide vooral om ${lowercaseFirst(market)}.` : "",
        trades ? `In de trades viel op dat ${lowercaseFirst(trades)}.` : "",
        trends ? `Daaromheen speelde ook ${lowercaseFirst(trends)}.` : "",
      ]
        .filter(Boolean)
        .slice(0, 3)
        .join(" ")
    : [
        market ? `The market context was mainly about ${lowercaseFirst(market)}.` : "",
        trades ? `In the trades, it stood out that ${lowercaseFirst(trades)}.` : "",
        trends ? `Around that, ${lowercaseFirst(trends)} also mattered.` : "",
      ]
        .filter(Boolean)
        .slice(0, 3)
        .join(" ");

  if (tradingText) {
    parts.push("", tradingHeading, tradingText);
  }

  const workText = buildWorkSectionText(work, language);
  if (workText) {
    parts.push("", workHeading, workText);
  }

  const energyText = language === "nl"
    ? [
        energy ? `Qua energie en gevoel kwam naar voren dat ${lowercaseFirst(energy)}.` : "",
        !energy && endOfDay
          ? `Emotioneel voelde de dag vooral als ${lowercaseFirst(endOfDay)}.`
          : "",
      ]
        .filter(Boolean)
        .slice(0, 2)
        .join(" ")
    : [
        energy
          ? `On the energy and mood side, it stood out that ${lowercaseFirst(energy)}.`
          : "",
        !energy && endOfDay
          ? `Emotionally, the day mostly felt like ${lowercaseFirst(endOfDay)}.`
          : "",
      ]
        .filter(Boolean)
        .slice(0, 2)
        .join(" ");

  if (energyText) {
    parts.push("", energyHeading, energyText);
  }

  const tomorrowText =
    language === "nl"
      ? tomorrowSetup.mainFocus
        ? `Morgen helpt het om de aandacht te richten op ${tomorrowSetup.mainFocus}${tomorrowTasks ? ` en te beginnen met ${tomorrowTasks}` : ""}.`
        : tomorrowTasks
          ? `Morgen helpt het om klein te blijven en te beginnen met ${tomorrowTasks}.`
          : "Morgen helpt het om het plan klein en duidelijk te houden."
      : tomorrowSetup.mainFocus
        ? `Tomorrow it helps to focus on ${tomorrowSetup.mainFocus}${tomorrowTasks ? ` and start with ${tomorrowTasks}` : ""}.`
        : tomorrowTasks
          ? `Tomorrow it helps to stay narrow and start with ${tomorrowTasks}.`
          : "Tomorrow it helps to keep the plan small and clear.";

  parts.push("", tomorrowHeading, tomorrowText);

  return parts.join("\n");
}

function summarizeLine(value: string) {
  const clean = value
    .replace(/\s+/g, " ")
    .replace(/^[^A-Za-zÀ-ÿ0-9]+/, "")
    .trim();

  if (!clean) {
    return "";
  }

  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0]?.trim() ?? clean;
  const withoutLabel = firstSentence
    .replace(/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s/:-]{0,40}:\s*/, "")
    .replace(/[.!?]+$/, "");

  return withoutLabel;
}

function matchesSectionCategory(
  section: { id: string; title: string; description: string; memo?: string },
  keywords: string[],
) {
  const haystack =
    `${section.id} ${section.title} ${section.description} ${section.memo ?? ""}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function logSummaryCandidate(source: string, summary: string) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug("[journal-summary]", "extracted-summary-candidate", {
    source,
    summary,
  });
}

function evaluateSummaryQuality(
  summary: string,
  {
    journalText,
    language,
    sectionTitles,
  }: {
    journalText: string;
    language: AppLanguage;
    sectionTitles: string[];
  },
) {
  const reasons: string[] = [];
  const trimmed = summary.trim();
  const sentenceCount = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const lowerSummary = trimmed.toLowerCase();
  const lowerJournal = journalText.toLowerCase();

  if (!trimmed) {
    reasons.push("empty");
  }

  if (wordCount < 35) {
    reasons.push("too-short");
  }

  if (sentenceCount < 4) {
    reasons.push("not-enough-sentences");
  }

  if (/^\s*(dag|patterns|patronen|morgen|day)\s+/i.test(trimmed)) {
    reasons.push("label-led");
  }

  if (trimmed.includes("\n-") || trimmed.includes("•")) {
    reasons.push("bullets");
  }

  if (!trimmed.includes("\n\n")) {
    reasons.push("missing-spacing");
  }

  const expectedHeadings =
    language === "nl" ? DUTCH_SECTION_HEADINGS : ENGLISH_SECTION_HEADINGS;
  const headingCount = expectedHeadings.filter((heading) => trimmed.includes(heading)).length;

  if (headingCount < 2) {
    reasons.push("missing-structure");
  }

  if (headingCount > 0 && !trimmed.startsWith(expectedHeadings[0])) {
    reasons.push("missing-title");
  }

  if (headingCount <= 1 && sentenceCount >= 4) {
    reasons.push("dense-block");
  }

  if (
    sectionTitles.some((title) => lowerSummary.includes(title.toLowerCase())) ||
    lowerSummary.includes("one sentence summary of the day")
  ) {
    reasons.push("section-titles-copied");
  }

  const thematicMatches = [
    ["bitcoin", "ema", "market", "chart", "markt"],
    ["trade", "trades", "stoploss", "entry", "positie"],
    ["power", "energie", "focus", "mood", "emotie"],
    ["morgen", "tomorrow"],
  ].filter((keywords) => {
    const presentInJournal = keywords.some((keyword) => lowerJournal.includes(keyword));
    const presentInSummary = keywords.some((keyword) => lowerSummary.includes(keyword));
    return presentInJournal && presentInSummary;
  }).length;

  if (thematicMatches < Math.min(2, countRelevantThemes(lowerJournal))) {
    reasons.push("missing-meaningful-content");
  }

  if (language === "nl" && /(?:day|patterns|tomorrow)\b/i.test(trimmed)) {
    reasons.push("not-natural-dutch");
  }

  return {
    isValid: reasons.length === 0,
    reasons,
    wordCount,
    sentenceCount,
  };
}

function countRelevantThemes(text: string) {
  return [
    ["bitcoin", "ema", "markt", "market", "chart"],
    ["trade", "trades", "stoploss", "entry"],
    ["werk", "business", "admin", "task", "taak"],
    ["power", "energie", "focus", "emotie", "mood"],
    ["morgen", "tomorrow"],
  ].filter((keywords) => keywords.some((keyword) => text.includes(keyword))).length;
}

function lowercaseFirst(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toLowerCase() + value.slice(1);
}

function buildWorkSectionText(value: string, language: AppLanguage) {
  const lower = value.toLowerCase();
  const workKeywords = [
    "business",
    "werk",
    "work",
    "admin",
    "client",
    "klant",
    "meeting",
    "call",
    "project",
    "task",
    "taak",
  ];

  if (!workKeywords.some((keyword) => lower.includes(keyword))) {
    return "";
  }

  return language === "nl"
    ? `Op werk- of businessvlak speelde vooral dat ${lowercaseFirst(value)}.`
    : `On the work or business side, the main thread was that ${lowercaseFirst(value)}.`;
}
