import {
  endOfMonth,
  parseISO,
  startOfMonth,
  subDays,
} from "date-fns";

import {
  buildStructuredJournalText,
  normalizeJournalSections,
} from "@/data/journal-template";
import {
  joinSentenceList,
  translateBlockerName,
  translateLifeAreaName,
  translateWeeklyState,
  type AppLanguage,
} from "@/lib/i18n";
import { getMonthRange, getWeekRange, toDateKey } from "@/lib/date";
import { average, clamp, createId, unique } from "@/lib/utils";
import {
  buildLifeAreaDistribution,
  getCarryOverUrgency,
} from "@/services/planning-service";
import type {
  AiInsight,
  AppState,
  CorrelationSnapshot,
  JournalConfig,
  JournalActionSuggestion,
  JournalEntry,
  JournalEntryInput,
  JournalSentiment,
  LifeAreaBalanceSnapshot,
  MonthlyPatternProfile,
  StreakSnapshot,
  TodaySuggestion,
  WeeklyReviewSnapshot,
  WeeklyState,
} from "@/types";

const blockerKeywords: Record<string, string[]> = {
  procrastination: ["procrast", "avoid", "later", "delay", "postpone", "stalled"],
  "low energy": ["tired", "low energy", "drained", "exhausted", "sluggish"],
  "unclear priorities": ["unclear", "confused", "too broad", "scattered", "too many tasks"],
  overplanning: ["overplanned", "too much", "too many", "overwhelmed", "packed list"],
  "emotional hesitation": ["hesitant", "anxious", "doubt", "fear", "second-guessed"],
  "market emotional instability": [
    "fomo",
    "panic",
    "revenge",
    "chased",
    "market shook me",
    "emotional trade",
  ],
};

const positiveKeywords = [
  "clear",
  "calm",
  "steady",
  "grateful",
  "focused",
  "good",
  "strong",
  "productive",
  "confident",
  "patient",
];

const negativeKeywords = [
  "scattered",
  "tired",
  "drained",
  "low energy",
  "overwhelmed",
  "anxious",
  "stuck",
  "avoid",
  "hesitant",
  "frustrated",
  "fomo",
  "panic",
];

function buildSectionHint(sectionId: string, journalConfig?: JournalConfig) {
  const section = journalConfig?.sections.find((candidate) => candidate.id === sectionId);

  return `${sectionId} ${section?.title ?? ""} ${section?.description ?? ""}`.toLowerCase();
}

function findFirstSectionMemo(
  sections: JournalEntryInput["sections"],
  journalConfig: JournalConfig | undefined,
  keywords: string[],
) {
  for (const [sectionId, values] of Object.entries(sections)) {
    const memo = values?.memo?.trim();

    if (!memo) {
      continue;
    }

    const hint = buildSectionHint(sectionId, journalConfig);
    if (keywords.some((keyword) => hint.includes(keyword))) {
      return memo;
    }
  }

  return "";
}

function firstSentence(value: string) {
  return value
    .trim()
    .split(/(?<=[.!?])\s+/)[0]
    ?.trim() ?? "";
}

function flattenJournalText(
  entryLike: Pick<JournalEntryInput, "sections" | "editedTranscript" | "rawTranscript">,
  journalConfig?: JournalConfig,
) {
  const normalizedSections = normalizeJournalSections(entryLike.sections, journalConfig);
  const sectionText = buildStructuredJournalText(normalizedSections, journalConfig);
  const editedText = entryLike.editedTranscript.trim();
  const mergedEditedText =
    editedText && editedText !== sectionText ? ` ${editedText}` : "";

  return `${sectionText}${mergedEditedText} ${entryLike.rawTranscript}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function countKeywordMatches(text: string, keywords: string[]) {
  return keywords.reduce((count, keyword) => {
    return count + (text.includes(keyword.toLowerCase()) ? 1 : 0);
  }, 0);
}

export function analyzeJournalEntryContent(
  entryLike: JournalEntryInput,
  lifeAreas: string[],
  journalConfig?: JournalConfig,
) {
  const normalizedSections = normalizeJournalSections(entryLike.sections, journalConfig);
  const text = flattenJournalText(entryLike, journalConfig);
  const positiveScore = countKeywordMatches(text, positiveKeywords);
  const negativeScore = countKeywordMatches(text, negativeKeywords);
  const moodScore = clamp(5 + positiveScore - negativeScore, 1, 10);
  const blockersDetected = Object.entries(blockerKeywords)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([name]) => name);

  const lifeAreasMentioned = lifeAreas.filter((lifeArea) => text.includes(lifeArea));

  let sentiment: JournalSentiment = "steady";
  if (moodScore >= 7) {
    sentiment = "uplifted";
  } else if (moodScore <= 4) {
    sentiment = "low";
  }

  const powerMemo = findFirstSectionMemo(normalizedSections, journalConfig, [
    "power",
    "energy",
    "mood",
    "focus",
    "health",
    "energie",
    "stemming",
  ]);
  const rawPowerLevel =
    powerMemo.match(/\b([1-9]|10)\b/)?.[0] ||
    "";
  const powerLevel = clamp(Number.parseInt(rawPowerLevel, 10) || moodScore, 1, 10);

  const oneSentenceDaySummary = firstSentence(
    findFirstSectionMemo(normalizedSections, journalConfig, [
      "summary",
      "recap",
      "wrap",
      "lesson",
      "samenvatting",
      "reflect",
      "reflectie",
    ]) ||
      entryLike.editedTranscript ||
      entryLike.rawTranscript ||
      buildStructuredJournalText(normalizedSections, journalConfig),
  );

  return {
    sentiment,
    moodScore,
    powerLevel,
    lifeAreasMentioned,
    blockersDetected,
    oneSentenceDaySummary,
    actionSuggestions: extractActionSuggestions(text),
  };
}

export function extractActionSuggestions(
  text: string,
  language: AppLanguage = "en",
) {
  const sentences = text
    .split(/[.!?]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const actionSignals = ["need to", "should", "must", "tomorrow", "next time", "follow up", "watch out"];

  return sentences
    .filter((sentence) => actionSignals.some((signal) => sentence.includes(signal)))
    .slice(0, 4)
    .map<JournalActionSuggestion>((sentence) => ({
      id: createId("action"),
      text: sentence.charAt(0).toUpperCase() + sentence.slice(1),
      context: sentence.includes("tomorrow")
        ? language === "nl"
          ? "Handig als taak voor morgen"
          : "Useful as a task for tomorrow"
        : language === "nl"
          ? "Handig als weekfocus of herinnering"
          : "Useful as a weekly focus or reminder",
    }));
}

function entriesInRange(entries: JournalEntry[], start: string, end: string) {
  return entries.filter((entry) => entry.date >= start && entry.date <= end);
}

function tasksInRange(state: AppState, start: string, end: string) {
  return state.dailyTasks.filter((task) => task.date >= start && task.date <= end);
}

function completedRate(tasks: AppState["dailyTasks"]) {
  if (tasks.length === 0) {
    return 0;
  }

  return Math.round((tasks.filter((task) => task.completed).length / tasks.length) * 100);
}

export function getStateOfWeek(state: AppState, dateKey: string): WeeklyState {
  const week = getWeekRange(dateKey);
  const weekTasks = tasksInRange(state, week.startKey, week.endKey);
  const weekEntries = entriesInRange(state.journalEntries, week.startKey, week.endKey);
  const completion = completedRate(weekTasks);
  const averageMood = average(weekEntries.map((entry) => entry.moodScore));
  const blockerCount = unique(weekEntries.flatMap((entry) => entry.blockersDetected)).length;

  if (completion >= 75 && averageMood >= 6.5) {
    return "On Track";
  }

  if (completion >= 60 && blockerCount <= 1) {
    return "Gaining Momentum";
  }

  if (completion < 45 && averageMood <= 4.5) {
    return "Needs Reset";
  }

  if (completion < 55 && blockerCount >= 3) {
    return "Slightly Overloaded";
  }

  if (averageMood >= 6 && completion < 55) {
    return "Recovering Well";
  }

  return "Mixed Week";
}

export function getMoodProductivityCorrelation(
  state: AppState,
  dateKey: string,
  language: AppLanguage = "en",
): CorrelationSnapshot {
  const recentEntries = state.journalEntries.filter(
    (entry) => entry.date >= toDateKey(subDays(parseISO(dateKey), 20)) && entry.date <= dateKey,
  );

  const highPowerDays = recentEntries.filter((entry) => entry.powerLevel >= 7);
  const lowPowerDays = recentEntries.filter((entry) => entry.powerLevel <= 4);

  const completionForDays = (days: JournalEntry[]) =>
    average(
      days.map((entry) =>
        completedRate(state.dailyTasks.filter((task) => task.date === entry.date)),
      ),
    );

  const highPowerCompletionRate = Math.round(completionForDays(highPowerDays));
  const lowPowerCompletionRate = Math.round(completionForDays(lowPowerDays));
  const trend =
    highPowerCompletionRate > lowPowerCompletionRate
      ? language === "nl"
        ? "Dagen met meer energie zorgen nu voor duidelijk betere uitvoering."
        : "Higher-energy days are currently leading to better follow-through."
      : language === "nl"
        ? "Afronding lijkt vergelijkbaar over energieniveaus heen. Dat wijst eerder op planningsduidelijkheid als knelpunt."
        : "Completion looks similar across energy levels, which suggests the bottleneck may be planning clarity instead.";

  return {
    summary:
      highPowerDays.length === 0 && lowPowerDays.length === 0
        ? language === "nl"
          ? "Meer journal-check-ins helpen om te zien hoe stemming en uitvoering samen bewegen."
          : "More journal check-ins will help the app notice how mood and execution move together."
        : language === "nl"
          ? `Op sterkere dagen rond je ongeveer ${highPowerCompletionRate}% van je taken af, tegenover ${lowPowerCompletionRate}% op dagen met lagere energie.`
          : `On stronger days you complete about ${highPowerCompletionRate}% of tasks, compared with ${lowPowerCompletionRate}% on lower-energy days.`,
    highPowerCompletionRate,
    lowPowerCompletionRate,
    trend,
  };
}

export function getLifeAreaBalance(
  state: AppState,
  dateKey: string,
  language: AppLanguage = "en",
): LifeAreaBalanceSnapshot {
  const month = getMonthRange(dateKey, language);
  const distribution = buildLifeAreaDistribution(state, month.startKey, month.endKey);
  const orderedAreas = Object.entries(distribution).sort((left, right) => right[1] - left[1]);
  const dominant = orderedAreas
    .filter(([, count]) => count > 0)
    .slice(0, 2)
    .map(([name]) => translateLifeAreaName(name, language));
  const neglected = orderedAreas
    .filter(([, count]) => count === 0)
    .slice(0, 3)
    .map(([name]) => translateLifeAreaName(name, language));

  return {
    dominant,
    neglected,
    distribution,
    summary:
      dominant.length === 0
        ? language === "nl"
          ? "Zodra je doelen en taken toevoegt, verschijnt de balans tussen levensgebieden hier."
          : "Once you start adding goals and tasks, life-area balance will show up here."
        : language === "nl"
          ? `De meeste aandacht gaat deze maand naar ${joinSentenceList(dominant, language)}.${neglected.length > 0 ? ` ${joinSentenceList(neglected, language)} kreeg minder aandacht.` : ""}`
          : `Most attention this month is flowing into ${joinSentenceList(dominant, language)}.${neglected.length > 0 ? ` ${joinSentenceList(neglected, language)} has been quieter.` : ""}`,
  };
}

export function getRecurringBlockers(entries: JournalEntry[]) {
  const blockerCounts = entries.flatMap((entry) => entry.blockersDetected).reduce<Record<string, number>>(
    (counts, blocker) => {
      counts[blocker] = (counts[blocker] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return Object.entries(blockerCounts)
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])
    .map(([blocker]) => blocker);
}

export function generateTodaySuggestion(
  state: AppState,
  dateKey: string,
  language: AppLanguage = "en",
): TodaySuggestion {
  const overdueTasks = state.dailyTasks.filter((task) => !task.completed && task.date < dateKey);
  const todayTasks = state.dailyTasks.filter((task) => task.date === dateKey);
  const recentEntries = state.journalEntries
    .filter((entry) => entry.date <= dateKey)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 5);
  const recurringBlockers = getRecurringBlockers(recentEntries);
  const highestUrgencyTask = overdueTasks.sort(
    (left, right) => getCarryOverUrgency(right, dateKey) - getCarryOverUrgency(left, dateKey),
  )[0];

  if (highestUrgencyTask) {
    return {
      title: language === "nl" ? "Begin smaller vandaag" : "Start narrower today",
      summary:
        language === "nl"
          ? "Eén uitgestelde taak draagt nu meer gewicht dan de rest. Als je die eerst oplost, wordt de dag waarschijnlijk rustiger."
          : "One postponed task is carrying more weight than the rest. Clearing that friction first will likely calm the whole day down.",
      suggestions: [
        language === "nl"
          ? `Raak "${highestUrgencyTask.title}" eerst aan voordat je iets nieuws toevoegt.`
          : `Touch "${highestUrgencyTask.title}" before adding anything new.`,
        language === "nl"
          ? "Houd de rest van de lijst bewust klein tot deze taak weer beweegt."
          : "Keep the rest of the list intentionally small until that task is moving again.",
      ],
    };
  }

  if (recurringBlockers.includes("low energy")) {
    return {
      title: language === "nl" ? "Bescherm je energieraam" : "Protect your energy window",
      summary:
        language === "nl"
          ? "Recente reflecties laten zien dat je beter uitvoert als het plan kleiner is en het eerste uur beschermd blijft."
          : "Recent reflections suggest follow-through is better when the plan is smaller and the first hour is protected.",
      suggestions: [
        language === "nl"
          ? "Kies één hoofdtaak en één makkelijke winst."
          : "Choose one main task and one easy win.",
        language === "nl"
          ? "Laat de rest wachten tot je energie stabieler voelt."
          : "Let the rest wait until your energy feels stable.",
      ],
    };
  }

  const openHighPriority = todayTasks.find(
    (task) => task.priority === "high" && !task.completed,
  );
  if (openHighPriority) {
    return {
      title: language === "nl" ? "Houd de dag centraal" : "Keep the day centered",
      summary:
        language === "nl"
          ? "Je duidelijkste pad vandaag blijft simpel: rond de taak met de meeste hefboom af voordat je het plan breder maakt."
          : "Your clearest path today is still simple: finish the highest-leverage task before widening the plan.",
      suggestions: [
        language === "nl"
          ? `Rond "${openHighPriority.title}" af voordat je zijpaden opent.`
          : `Finish "${openHighPriority.title}" before opening side loops.`,
      ],
    };
  }

  return {
    title: language === "nl" ? "Blijf rustig consistent" : "Stay gently consistent",
    summary:
      language === "nl"
        ? "Je hebt vandaag geen grote reset nodig. Een rustig plan en één eerlijke check-in vanavond zijn genoeg."
        : "You do not need a dramatic reset today. A calm plan and one honest review tonight will be enough.",
    suggestions: [
      language === "nl"
        ? "Houd je top drie zichtbaar."
        : "Keep your top three visible.",
      language === "nl"
        ? "Laat ruimte voor een rustige avondcheck."
        : "Leave room for a slower evening check-in.",
    ],
  };
}

export function generateAiInsights(
  state: AppState,
  dateKey: string,
  language: AppLanguage = "en",
): AiInsight[] {
  const week = getWeekRange(dateKey, language);
  const month = getMonthRange(dateKey, language);
  const weekEntries = entriesInRange(state.journalEntries, week.startKey, week.endKey);
  const weekTasks = tasksInRange(state, week.startKey, week.endKey);
  const recurringBlockers = getRecurringBlockers(
    state.journalEntries.filter((entry) => entry.date <= dateKey).slice(-12),
  );
  const correlation = getMoodProductivityCorrelation(state, dateKey, language);
  const lifeAreaBalance = getLifeAreaBalance(state, dateKey, language);
  const stateOfWeek = getStateOfWeek(state, dateKey);
  const translatedRecurringBlockers = recurringBlockers.map((blocker) =>
    translateBlockerName(blocker, language),
  );

  return [
    {
      id: createId("insight"),
      type: "weekly",
      dateRange: { label: week.label, start: week.startKey, end: week.endKey },
      title: language === "nl" ? "Weekbeeld" : "Weekly pulse",
      summary:
        language === "nl"
          ? `Deze week voelt nu als ${translateWeeklyState(stateOfWeek, language).toLowerCase()}. Taakafronding is ${completedRate(weekTasks)}%, met ${weekEntries.length} journal-check-ins die het beeld ondersteunen.`
          : `This week is currently reading as ${stateOfWeek.toLowerCase()}. Task completion is ${completedRate(weekTasks)}%, with ${weekEntries.length} journal check-ins grounding the story.`,
      suggestions: [
        language === "nl"
          ? "Houd het plan eerlijk genoeg zodat morgen nog haalbaar voelt."
          : "Keep the plan honest enough that tomorrow still feels approachable.",
        language === "nl"
          ? "Als de week te breed voelt, schrap eerst één niet-essentiële verplichting."
          : "If the week feels broad, reduce one nonessential commitment before adding more.",
      ],
      detectedPatterns: unique(weekEntries.flatMap((entry) => entry.blockersDetected)).slice(0, 3),
      recurringBlockers,
      stateOfWeek,
      priorityAreas: lifeAreaBalance.dominant,
      createdAt: new Date().toISOString(),
    },
    {
      id: createId("insight"),
      type: "coaching",
      dateRange: {
        label: language === "nl" ? "Recent patroon" : "Recent pattern",
        start: week.startKey,
        end: week.endKey,
      },
      title: language === "nl" ? "Stemming en uitvoering" : "Mood and execution",
      summary: correlation.summary,
      suggestions: [correlation.trend],
      detectedPatterns: [
        language === "nl" ? "Samenhang tussen stemming en productiviteit" : "Mood-to-productivity correlation",
      ],
      recurringBlockers,
      priorityAreas: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: createId("insight"),
      type: "blocker",
      dateRange: {
        label: language === "nl" ? "Recente frictie" : "Recent friction",
        start: week.startKey,
        end: week.endKey,
      },
      title: language === "nl" ? "Terugkerende blokkades" : "Recurring blockers",
      summary:
        recurringBlockers.length === 0
          ? language === "nl"
            ? "Nog geen blokkadepatroon herhaalt zich genoeg om structureel te zijn."
            : "No blocker theme has repeated enough to feel structural yet."
          : language === "nl"
            ? `De meest terugkerende fricties zijn nu ${joinSentenceList(translatedRecurringBlockers, language)}.`
            : `The most repeated friction points right now are ${joinSentenceList(translatedRecurringBlockers, language)}.`,
      suggestions:
        recurringBlockers.length === 0
          ? [
              language === "nl"
                ? "Blijf consistent journalen zodat subtielere patronen zichtbaar worden."
                : "Keep journaling consistently so softer patterns can become visible.",
            ]
          : recurringBlockers.map((blocker) => {
              if (blocker === "overplanning") {
                return language === "nl"
                  ? "Als planning te breed wordt, begrens morgen dan op drie echte taken."
                  : "When planning starts to widen, cap tomorrow at three real tasks.";
              }

              if (blocker === "low energy") {
                return language === "nl"
                  ? "Behandel dagen met lage energie als input, niet als falen. Lichtere plannen kunnen helpen."
                  : "Treat low-energy days as design inputs, not failures. Lighter plans may help.";
              }

              return language === "nl"
                ? `Pauzeer en vereenvoudig zodra ${translateBlockerName(blocker, language)} weer begint op te duiken.`
                : `Pause and simplify when ${translateBlockerName(blocker, language)} starts to show up again.`;
            }),
      detectedPatterns: translatedRecurringBlockers,
      recurringBlockers: translatedRecurringBlockers,
      priorityAreas: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: createId("insight"),
      type: "balance",
      dateRange: { label: month.label, start: month.startKey, end: month.endKey },
      title: language === "nl" ? "Balans tussen gebieden" : "Life-area balance",
      summary: lifeAreaBalance.summary,
      suggestions:
        lifeAreaBalance.neglected.length === 0
          ? [
              language === "nl"
                ? "Je aandacht lijkt deze maand redelijk in balans."
                : "Your attention spread looks relatively balanced this month.",
            ]
          : [
              language === "nl"
                ? `Overweeg deze week één kleine check-in voor ${lifeAreaBalance.neglected[0]}.`
                : `Consider one small check-in for ${lifeAreaBalance.neglected[0]} this week.`,
            ],
      detectedPatterns: lifeAreaBalance.dominant,
      recurringBlockers: [],
      priorityAreas: lifeAreaBalance.neglected,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function generateWeeklyReview(
  state: AppState,
  dateKey: string,
  language: AppLanguage = "en",
): WeeklyReviewSnapshot {
  const week = getWeekRange(dateKey, language);
  const completedTasks = tasksInRange(state, week.startKey, week.endKey).filter(
    (task) => task.completed,
  );
  const incompleteTasks = tasksInRange(state, week.startKey, week.endKey).filter(
    (task) => !task.completed,
  );
  const carryOverTasks = incompleteTasks.filter((task) => task.carryOverCount >= 1);
  const journalEntries = entriesInRange(state.journalEntries, week.startKey, week.endKey);
  const blockerThemes = getRecurringBlockers(journalEntries);
  const stateOfWeek = getStateOfWeek(state, dateKey);

  const suggestedFocus =
    blockerThemes.includes("overplanning")
      ? language === "nl"
        ? "Maak volgende week smaller voordat je het optimaliseert."
        : "Narrow next week before you optimize it."
      : blockerThemes.includes("low energy")
        ? language === "nl"
          ? "Bescherm herstel en houd het eerste uur lichter."
          : "Protect recovery and use a lighter first hour."
        : completedTasks.length >= incompleteTasks.length
          ? language === "nl"
            ? "Houd hetzelfde ritme vast en maak de overgang naar elke dag strakker."
            : "Keep the same rhythm and tighten the handoff into each day."
          : language === "nl"
            ? "Reset rond één wekelijkse ankerdoel in plaats van te veel parallelle doelen."
            : "Reset around one weekly anchor goal instead of too many parallel aims.";

  return {
    weekLabel: week.label,
    completedTasks,
    incompleteTasks,
    carryOverTasks,
    journalEntries,
    blockerThemes,
    suggestions: [
      language === "nl"
        ? "Kijk terug op wat echt bewoog en wat alleen dringend leek."
        : "Review what genuinely moved and what only looked urgent.",
      suggestedFocus,
      carryOverTasks.length > 0
        ? language === "nl"
          ? "Pak begin volgende week de oudste uitgestelde taak aan, zodat die geen aandacht meer opslokt."
          : "Clear the oldest postponed task early next week so it stops absorbing attention."
        : language === "nl"
          ? "Er is ruimte om volgende week fris te starten zonder zware achterstand."
          : "There is room to start next week fresh without a heavy backlog.",
    ],
    stateOfWeek,
    suggestedFocus,
  };
}

export function generateMonthlyPatternProfile(
  state: AppState,
  dateKey: string,
  language: AppLanguage = "en",
): MonthlyPatternProfile {
  const monthStart = startOfMonth(parseISO(dateKey));
  const monthEnd = endOfMonth(parseISO(dateKey));
  const range = {
    start: toDateKey(monthStart),
    end: toDateKey(monthEnd),
  };
  const monthEntries = entriesInRange(state.journalEntries, range.start, range.end);
  const monthTasks = tasksInRange(state, range.start, range.end);
  const distribution = buildLifeAreaDistribution(state, range.start, range.end);
  const recurringBlockers = getRecurringBlockers(monthEntries);
  const translatedRecurringBlockers = recurringBlockers.map((blocker) =>
    translateBlockerName(blocker, language),
  );
  const productiveConditions = unique(
    monthEntries.flatMap((entry) => {
      const conditions: string[] = [];
      if (entry.powerLevel >= 7) {
        conditions.push(
          language === "nl"
            ? "Meer energie ondersteunt sterkere uitvoering."
            : "Higher energy supports stronger execution.",
        );
      }
      if (entry.sentiment === "uplifted") {
        conditions.push(
          language === "nl"
            ? "Een helderdere emotionele toon ondersteunt vaak stabielere opvolging."
            : "Clearer emotional tone tends to support steadier follow-through.",
        );
      }
      if (entry.blockersDetected.length === 0) {
        conditions.push(
          language === "nl"
            ? "Eenvoudigere dagen geven helderdere reflectie en minder doorschuiven."
            : "Simpler days create cleaner reflection and less carry-over.",
        );
      }
      return conditions;
    }),
  ).slice(0, 4);

  const weakerPatterns = unique(
    monthEntries.flatMap((entry) => {
      const patterns: string[] = [];
      if (entry.powerLevel <= 4) {
        patterns.push(
          language === "nl"
            ? "Dagen met minder power leiden vaak tot onafgemaakte taken."
            : "Lower power days often lead to unfinished tasks.",
        );
      }
      if (entry.blockersDetected.includes("overplanning")) {
        patterns.push(
          language === "nl"
            ? "Het plan wordt moeilijker uitvoerbaar zodra het te breed wordt."
            : "The plan becomes harder to execute when it grows too broad.",
        );
      }
      if (entry.blockersDetected.includes("market emotional instability")) {
        patterns.push(
          language === "nl"
            ? "Emotionele marktreacties kunnen overlopen in de rest van de dag."
            : "Emotional market reactions can spill into the rest of the day.",
        );
      }
      return patterns;
    }),
  ).slice(0, 4);

  return {
    id: createId("monthly-profile"),
    month: monthStart.getMonth() + 1,
    year: monthStart.getFullYear(),
    strongestPatterns: [
      completedRate(monthTasks) >= 65
        ? language === "nl"
          ? "Je beweegt meestal goed als de takenlijst smal en zichtbaar blijft."
          : "You tend to move well when the task list stays narrow and visible."
        : language === "nl"
          ? "Momentum verbetert wanneer de dag één duidelijke prioriteit heeft."
          : "Momentum improves when the day has a clearer single priority.",
      monthEntries.length >= 6
        ? language === "nl"
          ? "Regelmatig journalen geeft je meer emotioneel zicht over de maand."
          : "Regular journaling is giving you better emotional visibility across the month."
        : language === "nl"
          ? "Vaker reflecteren zou het maandbeeld scherper maken."
          : "More frequent reflection would make the monthly picture sharper.",
    ],
    blockers:
      recurringBlockers.length > 0
        ? translatedRecurringBlockers.map((blocker) =>
            language === "nl"
              ? `Terugkerende blokkade: ${blocker}.`
              : `Recurring blocker: ${blocker}.`,
          )
        : [
            language === "nl"
              ? "Geen blokkade herhaalde zich genoeg om de maand te domineren."
              : "No blocker repeated enough to dominate the month.",
          ],
    productiveConditions:
      productiveConditions.length > 0
        ? productiveConditions
        : [
            language === "nl"
              ? "Je bouwt nog aan genoeg data om je sterkste omstandigheden te beschrijven."
              : "You are still building the data needed to describe your strongest conditions.",
          ],
    weakerPatterns:
      weakerPatterns.length > 0
        ? weakerPatterns
        : [
            language === "nl"
              ? "Zwakkere patronen worden duidelijker naarmate meer dagen worden gelogd."
              : "Weaker patterns will become clearer as more days are logged.",
          ],
    lifeAreaDistribution: distribution,
    monthlyAdvice: [
      recurringBlockers.includes("overplanning")
        ? language === "nl"
          ? "Verminder volgende maand eerst het aantal actieve prioriteiten voordat je ambitie opvoert."
          : "Next month, reduce the number of active priorities before increasing ambition."
        : language === "nl"
          ? "Houd volgende maand gecentreerd rond één of twee echte ankers."
          : "Keep next month centered around one or two real anchors.",
      recurringBlockers.includes("low energy")
        ? language === "nl"
          ? "Bouw herstel in het plan in, in plaats van te hopen dat de energie standhoudt."
          : "Build recovery into the plan instead of hoping energy will hold."
        : language === "nl"
          ? "Blijf de omstandigheden beschermen die stabielere dagen geven."
          : "Keep protecting the conditions that create steadier days.",
      language === "nl"
        ? "Gebruik de morgen-opzet als brug tussen reflectie en uitvoering."
        : "Use tomorrow setup as the bridge between reflection and execution.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export function getStreaks(
  state: AppState,
  dateKey: string,
  language: AppLanguage = "en",
): StreakSnapshot {
  let reflectionStreak = 0;
  let focusStreak = 0;
  let planningConsistencyStreak = 0;

  for (let index = 0; index < 30; index += 1) {
    const currentDate = toDateKey(subDays(parseISO(dateKey), index));
    const hasJournal = state.journalEntries.some((entry) => entry.date === currentDate);
    const hasFocus = state.dailyFocuses.some(
      (focus) => focus.date === currentDate && focus.mainFocus.trim().length > 0,
    );
    const hasPlan =
      hasFocus ||
      state.dailyTasks.some((task) => task.date === currentDate) ||
      state.weeklyGoals.some(
        (goal) => goal.startDate <= currentDate && goal.endDate >= currentDate,
      );

    if (index === reflectionStreak && hasJournal) {
      reflectionStreak += 1;
    }

    if (index === focusStreak && hasFocus) {
      focusStreak += 1;
    }

    if (index === planningConsistencyStreak && hasPlan) {
      planningConsistencyStreak += 1;
    }
  }

  return {
    reflectionStreak,
    focusStreak,
    planningConsistencyStreak,
    supportiveCopy: [
      reflectionStreak > 0
        ? language === "nl"
          ? `Je hebt ${reflectionStreak} ${reflectionStreak === 1 ? "dag" : "dagen"} op rij gereflecteerd.`
          : `You've reflected ${reflectionStreak} day${reflectionStreak === 1 ? "" : "s"} in a row.`
        : language === "nl"
          ? "Eén check-in vanavond kan je reflectieritme opnieuw starten."
          : "A single check-in tonight can restart your reflection rhythm.",
      focusStreak > 0
        ? language === "nl"
          ? `Je hebt ${focusStreak} ${focusStreak === 1 ? "dag" : "dagen"} achter elkaar een focus gezet.`
          : `You've set a focus for ${focusStreak} day${focusStreak === 1 ? "" : "s"} straight.`
        : language === "nl"
          ? "Een korte focuszin kan de dag lichter maken."
          : "A short focus statement can make the day feel lighter.",
      planningConsistencyStreak > 0
        ? language === "nl"
          ? `Je plant al ${planningConsistencyStreak} ${planningConsistencyStreak === 1 ? "dag" : "dagen"} consistent.`
          : `You've been planning consistently for ${planningConsistencyStreak} day${planningConsistencyStreak === 1 ? "" : "s"}.`
        : language === "nl"
          ? "Zelfs een klein plan telt mee als je weer consistentie wilt opbouwen."
          : "Even a tiny plan counts when you want to rebuild consistency.",
    ],
  };
}
