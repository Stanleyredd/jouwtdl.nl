"use client";

import {
  type MutableRefObject,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BrainCircuit,
  CalendarArrowUp,
  Flag,
  ListTodo,
  LoaderCircle,
  Save,
  Sparkles,
} from "lucide-react";

import {
  buildJournalTemplateSections,
  buildStructuredJournalText,
  createEmptyJournalSections,
  normalizeJournalSections,
} from "@/data/journal-template";
import { useLanguage } from "@/hooks/use-language";
import type { VoiceResult } from "@/hooks/use-voice-transcription";
import { getWeekRange, shiftDate } from "@/lib/date";
import {
  translateLifeAreaName,
  translateRuntimeMessage,
  translateSentiment,
} from "@/lib/i18n";
import {
  analyzeJournalEntryContent,
  extractActionSuggestions,
} from "@/services/analysis-service";
import { generateJournalSummary } from "@/services/journal-summary-service";
import { TomorrowSetupPanel } from "@/components/tomorrow-setup-panel";
import { VoiceRecorderButton } from "@/components/voice-recorder-button";
import type {
  JournalConfig,
  JournalEntry,
  JournalEntryInput,
  MonthlyGoal,
  TomorrowSetup,
  WeeklyGoal,
} from "@/types";

interface JournalTemplateFormProps {
  date: string;
  existingEntry?: JournalEntry;
  journalConfig: JournalConfig;
  lifeAreas: string[];
  weeklyGoals: WeeklyGoal[];
  monthlyGoals: MonthlyGoal[];
  voice: VoiceResult;
  activeVoiceTarget: {
    sectionId: string;
    fieldId: string;
  } | null;
  voiceInsertHandlerRef: MutableRefObject<
    ((sectionId: string, fieldId: string, transcript: string) => void) | null
  >;
  onSave: (value: JournalEntryInput) => Promise<JournalEntry>;
  onUpdateSummary: (
    date: string,
    updates: {
      aiSummary?: string;
      aiSummaryError?: string | null;
    },
  ) => Promise<JournalEntry | null>;
  onCreateTask: (
    text: string,
    weeklyGoalId: string | null,
    date: string,
    lifeArea: string,
  ) => void;
  onCreateWeeklyGoal: (
    text: string,
    monthlyGoalId: string | null,
    lifeArea: string,
    startDate: string,
    endDate: string,
  ) => void;
  onStartVoice: (sectionId: string, fieldId: string) => void;
  onCancelVoice: () => void;
  onStopVoice: () => void;
  onResetVoice: (sectionId: string, fieldId: string) => void;
}

type SavePhase = "idle" | "saving" | "summarizing" | "saved" | "error";

const SECTION_FIELD_ID = "memo";

const emptyTomorrowSetup: TomorrowSetup = {
  mainFocus: "",
  topTasks: [],
  watchOutFor: "",
  intention: "",
};

export function JournalTemplateForm({
  date,
  existingEntry,
  journalConfig,
  lifeAreas,
  weeklyGoals,
  monthlyGoals,
  voice,
  activeVoiceTarget,
  voiceInsertHandlerRef,
  onSave,
  onUpdateSummary,
  onCreateTask,
  onCreateWeeklyGoal,
  onStartVoice,
  onCancelVoice,
  onStopVoice,
  onResetVoice,
}: JournalTemplateFormProps) {
  const { language, t } = useLanguage();
  const templateSections = useMemo(
    () => buildJournalTemplateSections(journalConfig),
    [journalConfig],
  );
  const [sections, setSections] = useState(() =>
    normalizeJournalSections(
      existingEntry?.sections ?? createEmptyJournalSections(journalConfig),
      journalConfig,
    ),
  );
  const [rawTranscript, setRawTranscript] = useState(
    () => existingEntry?.rawTranscript ?? "",
  );
  const [tomorrowSetup, setTomorrowSetup] = useState<TomorrowSetup>(
    () => existingEntry?.tomorrowSetup ?? emptyTomorrowSetup,
  );
  const [savePhase, setSavePhase] = useState<SavePhase>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [summaryText, setSummaryText] = useState(existingEntry?.aiSummary ?? "");
  const [summaryError, setSummaryError] = useState<string | null>(
    existingEntry?.aiSummaryError ?? null,
  );
  const [selectedWeeklyGoalId, setSelectedWeeklyGoalId] = useState(weeklyGoals[0]?.id ?? "");
  const [selectedMonthlyGoalId, setSelectedMonthlyGoalId] = useState(monthlyGoals[0]?.id ?? "");
  const [selectedLifeArea, setSelectedLifeArea] = useState(lifeAreas[0] ?? "trading");

  const structuredJournalText = useMemo(
    () => buildStructuredJournalText(sections, journalConfig),
    [journalConfig, sections],
  );

  const combinedText = useMemo(() => {
    return `${structuredJournalText} ${rawTranscript}`.replace(/\s+/g, " ").trim();
  }, [rawTranscript, structuredJournalText]);

  const actionSuggestions = useMemo(
    () => extractActionSuggestions(combinedText.toLowerCase(), language),
    [combinedText, language],
  );

  const analysisPreview = useMemo(
    () =>
      analyzeJournalEntryContent(
        {
          date,
          sections,
          rawTranscript,
          editedTranscript: structuredJournalText,
          tomorrowSetup,
        },
        lifeAreas,
        journalConfig,
      ),
    [date, journalConfig, lifeAreas, rawTranscript, sections, structuredJournalText, tomorrowSetup],
  );

  const tomorrowDate = shiftDate(date, 1);
  const isSaving = savePhase === "saving" || savePhase === "summarizing";
  const canRetrySummary =
    structuredJournalText.trim().length > 0 &&
    (Boolean(existingEntry) || savePhase === "saved");

  const appendTranscript = useCallback(
    (sectionId: string, fieldId: string, transcript: string) => {
      if (!transcript.trim()) {
        return;
      }

      if (sectionId === "tomorrow_setup") {
        if (fieldId === "mainFocus") {
          setTomorrowSetup((current) => ({
            ...current,
            mainFocus: `${current.mainFocus} ${transcript}`.trim(),
          }));
        }

        if (fieldId === "topTasks") {
          setTomorrowSetup((current) => ({
            ...current,
            topTasks: `${current.topTasks.filter(Boolean).join("\n")} ${transcript}`
              .trim()
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          }));
        }

        setRawTranscript((current) => `${current} ${transcript}`.trim());
        return;
      }

      setSections((currentSections) => ({
        ...currentSections,
        [sectionId]: {
          [SECTION_FIELD_ID]: `${currentSections[sectionId]?.[SECTION_FIELD_ID] ?? ""} ${transcript}`.trim(),
        },
      }));
      setRawTranscript((current) => `${current} ${transcript}`.trim());
    },
    [],
  );

  useEffect(() => {
    voiceInsertHandlerRef.current = appendTranscript;

    return () => {
      if (voiceInsertHandlerRef.current === appendTranscript) {
        voiceInsertHandlerRef.current = null;
      }
    };
  }, [appendTranscript, voiceInsertHandlerRef]);

  function updateSectionMemo(sectionId: string, value: string) {
    setSections((currentSections) => ({
      ...currentSections,
      [sectionId]: {
        [SECTION_FIELD_ID]: value,
      },
    }));
  }

  function isActiveVoiceSection(sectionId: string) {
    return (
      activeVoiceTarget?.sectionId === sectionId &&
      activeVoiceTarget?.fieldId === SECTION_FIELD_ID
    );
  }

  function buildPayload(): JournalEntryInput {
    return {
      date,
      sections,
      rawTranscript,
      editedTranscript: structuredJournalText,
      tomorrowSetup,
    };
  }

  async function generateAndStoreSummary() {
    if (process.env.NODE_ENV === "development") {
      console.debug("[journal-summary]", "summary-request-started", { date });
      console.debug("[journal-summary]", "summary-payload-built", {
        date,
        sections,
        tomorrowSetup,
        language,
      });
    }

    setSavePhase("summarizing");
    setSaveMessage(t("journal.generating"));

    try {
      const summary = await generateJournalSummary({
        date,
        sections,
        tomorrowSetup,
        language,
        journalConfig,
      });

      await onUpdateSummary(date, {
        aiSummary: summary,
        aiSummaryError: null,
      });

      if (process.env.NODE_ENV === "development") {
        console.debug("[journal-summary]", "summary-save-succeeded", {
          date,
          summary,
        });
      }

      setSummaryText(summary);
      setSummaryError(null);
      setSavePhase("saved");
      setSaveMessage(t("journal.saved"));
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? translateRuntimeMessage(caughtError.message, language)
          : t("journal.summaryErrorFallback");

      await onUpdateSummary(date, {
        aiSummaryError: message,
      });

      if (process.env.NODE_ENV === "development") {
        console.error("[journal-summary]", "summary-save-failed", caughtError);
      }

      setSummaryError(message);
      setSavePhase("saved");
      setSaveMessage(t("journal.savedWithRetry"));
    }
  }

  async function saveEntry() {
    const payload = buildPayload();

    if (process.env.NODE_ENV === "development") {
      console.debug("[journal-save]", "save-clicked", {
        date,
        sections,
      });
      console.debug("[journal-save]", "current-journal-date", date);
      console.debug("[journal-save]", "current-active-section-data", sections);
      console.debug("[journal-save]", "assembled-journal-payload", payload);
    }

    try {
      setSavePhase("saving");
      setSaveMessage(t("journal.saving"));
      setSummaryError(null);

      const savedEntry = await onSave(payload);
      setSummaryText(savedEntry.aiSummary ?? "");

      await generateAndStoreSummary();
    } catch (caughtError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[journal-save]", "save-failed", caughtError);
      }

      setSavePhase("error");
      setSaveMessage(
        caughtError instanceof Error
          ? translateRuntimeMessage(caughtError.message, language)
          : t("journal.saveError"),
      );
    }
  }

  async function retrySummary() {
    await generateAndStoreSummary();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveEntry();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <section className="app-surface-strong app-panel-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="app-label">{t("journal.eyebrow")}</p>
            <h2 className="mt-2 text-[clamp(1.6rem,2.8vw,2.1rem)] font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
              {t("journal.reflect")}
            </h2>
            <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">
              {t("journal.intro")}
            </p>
          </div>
          <button type="submit" disabled={isSaving} className="app-button-primary text-sm">
            {isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savePhase === "saving"
              ? t("journal.saving")
              : savePhase === "summarizing"
                ? t("journal.generating")
                : t("journal.save")}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[color:var(--muted)]">
          <span className="font-medium capitalize text-[color:var(--foreground)]">
            {translateSentiment(analysisPreview.sentiment, language)}
          </span>
          <span>{t("journal.mood", { value: analysisPreview.moodScore })}</span>
          <span>{t("journal.power", { value: analysisPreview.powerLevel })}</span>
        </div>

        {saveMessage ? (
          <p
            className={`mt-4 text-sm ${
              savePhase === "error"
                ? "app-text-danger"
                : "text-[color:var(--accent-strong)]"
            }`}
          >
            {saveMessage}
          </p>
        ) : null}
      </section>

      {templateSections.map((section, sectionIndex) => {
        const field = section.fields[0];
        const value = sections[section.id]?.[SECTION_FIELD_ID] ?? "";
        const inputId = `${section.id}-${SECTION_FIELD_ID}`;

        return (
          <section key={section.id} className="app-surface app-panel">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-soft)]">
                    {t("journal.step", { number: sectionIndex + 1 })}
                  </span>
                  <p className="text-base font-semibold text-[color:var(--foreground)]">
                    {section.title}
                  </p>
                </div>
                {section.description ? (
                  <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">
                    {section.description}
                  </p>
                ) : null}
              </div>

              <VoiceRecorderButton
                compact
                fieldId={inputId}
                status={voice.status}
                supported={voice.supported}
                transcript={voice.transcript}
                error={voice.error}
                language={voice.language}
                recordingSeconds={voice.recordingSeconds}
                isActive={isActiveVoiceSection(section.id)}
                isBusy={voice.isBusy}
                isDisabled={voice.isBusy && !isActiveVoiceSection(section.id)}
                onStart={() => onStartVoice(section.id, SECTION_FIELD_ID)}
                onStop={onStopVoice}
                onCancel={onCancelVoice}
                onReset={() => onResetVoice(section.id, SECTION_FIELD_ID)}
              />
            </div>

            <textarea
              id={inputId}
              rows={field.rows ?? 5}
              value={value}
              onChange={(event) => updateSectionMemo(section.id, event.target.value)}
              placeholder={field.placeholder}
              className="app-input"
            />
          </section>
        );
      })}

      <section className="app-surface app-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
          <Sparkles className="h-4 w-4 text-[color:var(--accent-strong)]" />
          {t("journal.aiSummary")}
        </div>

          <button
            type="button"
            onClick={() => void retrySummary()}
            disabled={isSaving || !canRetrySummary}
            className="app-button-secondary text-sm"
          >
            {savePhase === "summarizing"
              ? t("journal.summaryGenerating")
              : t("journal.retrySummary")}
          </button>
        </div>

        {summaryText ? (
          <div className="mt-4 whitespace-pre-line text-sm leading-6 text-[color:var(--foreground)]">
            {summaryText}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-5 text-[color:var(--muted)]">
            {t("journal.summaryEmptyHint")}
          </p>
        )}

        {summaryError ? (
          <p className="mt-4 text-sm text-[color:var(--muted)]">{summaryError}</p>
        ) : null}
      </section>

      {journalConfig.tomorrowSetupEnabled ? (
        <TomorrowSetupPanel
          mode="edit"
          value={tomorrowSetup}
          onChange={setTomorrowSetup}
          voice={voice}
          activeVoiceTarget={activeVoiceTarget}
          onStartVoice={onStartVoice}
          onCancelVoice={onCancelVoice}
          onStopVoice={onStopVoice}
          onResetVoice={onResetVoice}
        />
      ) : null}

      <section className="app-surface app-panel">
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
          <BrainCircuit className="h-4 w-4 text-[color:var(--accent-strong)]" />
          {t("journal.actionTitle")}
        </div>
        <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">
          {t("journal.actionHint")}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <select
            value={selectedWeeklyGoalId}
            onChange={(event) => {
              setSelectedWeeklyGoalId(event.target.value);
              const selectedGoal = weeklyGoals.find((goal) => goal.id === event.target.value);
              if (selectedGoal) {
                setSelectedMonthlyGoalId(selectedGoal.monthlyGoalId ?? "");
                setSelectedLifeArea(selectedGoal.lifeArea);
              } else {
                setSelectedMonthlyGoalId("");
              }
            }}
            className="app-input"
          >
            <option value="">{t("common.other")}</option>
            {weeklyGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>

          <select
            value={selectedMonthlyGoalId}
            onChange={(event) => setSelectedMonthlyGoalId(event.target.value)}
            className="app-input"
          >
            <option value="">{t("common.other")}</option>
            {monthlyGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>

          <select
            value={selectedLifeArea}
            onChange={(event) => setSelectedLifeArea(event.target.value)}
            className="app-input"
          >
            {lifeAreas.map((lifeArea) => (
              <option key={lifeArea} value={lifeArea}>
                {translateLifeAreaName(lifeArea, language)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 space-y-3">
          {actionSuggestions.length > 0 ? (
            actionSuggestions.slice(0, 2).map((suggestion) => (
              <div key={suggestion.id} className="app-surface-soft rounded-[18px] p-4">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {suggestion.text}
                </p>
                <p className="mt-1 text-sm leading-5 text-[color:var(--muted)]">
                  {suggestion.context}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onCreateTask(
                        suggestion.text,
                        selectedWeeklyGoalId || null,
                        tomorrowDate,
                        selectedLifeArea,
                      )
                    }
                    className="app-button-primary text-sm"
                  >
                    <ListTodo className="h-4 w-4" />
                    {t("journal.actionTomorrow")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextWeek = getWeekRange(tomorrowDate);
                      onCreateWeeklyGoal(
                        suggestion.text,
                        selectedMonthlyGoalId || null,
                        selectedLifeArea,
                        nextWeek.startKey,
                        nextWeek.endKey,
                      );
                    }}
                    className="app-button-secondary text-sm"
                  >
                    <CalendarArrowUp className="h-4 w-4" />
                    {t("journal.actionWeek")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTomorrowSetup((current) => ({
                        ...current,
                        watchOutFor: current.watchOutFor
                          ? `${current.watchOutFor} ${suggestion.text}`.trim()
                          : suggestion.text,
                      }))
                    }
                    className="app-button-secondary text-sm"
                  >
                    <Flag className="h-4 w-4" />
                    {t("journal.tomorrow")}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-[color:var(--border)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              {t("journal.nextStepEmpty")}
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--muted)]">{t("journal.saveHint")}</p>
        <button type="submit" disabled={isSaving} className="app-button-primary text-sm">
          {isSaving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {savePhase === "saving"
            ? t("journal.saving")
            : savePhase === "summarizing"
              ? t("journal.generating")
              : t("journal.save")}
        </button>
      </div>
    </form>
  );
}
