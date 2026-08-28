"use client";

import {
  type MutableRefObject,
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
import { TomorrowSetupPanel } from "@/components/tomorrow-setup-panel";
import { VoiceRecorderButton } from "@/components/voice-recorder-button";
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
import type {
  JournalConfig,
  JournalEntry,
  JournalSections,
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
  onSaveSection: (
    date: string,
    input: {
      sectionKey: string;
      content: string;
      rawTranscript: string;
      editedTranscript: string;
    },
  ) => Promise<JournalEntry>;
  onSaveTomorrowSetup: (
    date: string,
    input: {
      tomorrowSetup: TomorrowSetup;
      rawTranscript: string;
      editedTranscript: string;
    },
  ) => Promise<JournalEntry>;
  onFinalize: (date: string) => Promise<JournalEntry>;
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

type LocalSavePhase = "idle" | "saving" | "saved" | "error";
type FinalizePhase = "idle" | "saving-drafts" | "finalizing" | "saved" | "error";

const SECTION_FIELD_ID = "memo";

function normalizeTomorrowSetupValue(value?: TomorrowSetup): TomorrowSetup {
  return {
    mainFocus: value?.mainFocus ?? "",
    topTasks: Array.isArray(value?.topTasks)
      ? value.topTasks.map((item) => item.trim()).filter(Boolean)
      : [],
    watchOutFor: value?.watchOutFor ?? "",
    intention: value?.intention ?? "",
  };
}

function getSectionMemoValue(sections: JournalSections, sectionId: string) {
  return sections[sectionId]?.[SECTION_FIELD_ID] ?? "";
}

function areTomorrowSetupsEqual(left: TomorrowSetup, right: TomorrowSetup) {
  return (
    left.mainFocus === right.mainFocus &&
    left.watchOutFor === right.watchOutFor &&
    left.intention === right.intention &&
    left.topTasks.length === right.topTasks.length &&
    left.topTasks.every((task, index) => task === right.topTasks[index])
  );
}

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
  onSaveSection,
  onSaveTomorrowSetup,
  onFinalize,
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
  const [savedSections, setSavedSections] = useState(() =>
    normalizeJournalSections(
      existingEntry?.sections ?? createEmptyJournalSections(journalConfig),
      journalConfig,
    ),
  );
  const [rawTranscript, setRawTranscript] = useState(
    () => existingEntry?.rawTranscript ?? "",
  );
  const [tomorrowSetup, setTomorrowSetup] = useState<TomorrowSetup>(
    () => normalizeTomorrowSetupValue(existingEntry?.tomorrowSetup),
  );
  const [savedTomorrowSetup, setSavedTomorrowSetup] = useState<TomorrowSetup>(
    () => normalizeTomorrowSetupValue(existingEntry?.tomorrowSetup),
  );
  const [sectionPhases, setSectionPhases] = useState<Record<string, LocalSavePhase>>(
    {},
  );
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>(
    {},
  );
  const [tomorrowPhase, setTomorrowPhase] = useState<LocalSavePhase>("idle");
  const [tomorrowError, setTomorrowError] = useState<string | null>(null);
  const [finalizePhase, setFinalizePhase] = useState<FinalizePhase>("idle");
  const [finalizeMessage, setFinalizeMessage] = useState("");
  const [summaryText, setSummaryText] = useState(existingEntry?.aiSummary ?? "");
  const [summaryError, setSummaryError] = useState<string | null>(
    existingEntry?.aiSummaryError ?? null,
  );
  const [isFinalized, setIsFinalized] = useState(Boolean(existingEntry?.finalizedAt));
  const [selectedWeeklyGoalId, setSelectedWeeklyGoalId] = useState(
    weeklyGoals[0]?.id ?? "",
  );
  const [selectedMonthlyGoalId, setSelectedMonthlyGoalId] = useState(
    monthlyGoals[0]?.id ?? "",
  );
  const [selectedLifeArea, setSelectedLifeArea] = useState(
    lifeAreas[0] ?? "trading",
  );

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
  const isFinalizing =
    finalizePhase === "saving-drafts" || finalizePhase === "finalizing";
  const canFinalize = structuredJournalText.trim().length > 0 && !isFinalizing;
  const isTomorrowDirty = useMemo(
    () => !areTomorrowSetupsEqual(tomorrowSetup, savedTomorrowSetup),
    [savedTomorrowSetup, tomorrowSetup],
  );

  const clearFinalizeState = useCallback(() => {
    setFinalizePhase((current) => (current === "idle" ? current : "idle"));
    setFinalizeMessage((current) => (current ? "" : current));
  }, []);

  const isSectionDirty = useCallback(
    (sectionId: string) =>
      getSectionMemoValue(sections, sectionId) !==
      getSectionMemoValue(savedSections, sectionId),
    [savedSections, sections],
  );

  const updateTomorrow = useCallback(
    (nextValue: TomorrowSetup) => {
      clearFinalizeState();
      setTomorrowError(null);
      setTomorrowPhase("idle");
      setTomorrowSetup(nextValue);
    },
    [clearFinalizeState],
  );

  const appendTranscript = useCallback(
    (sectionId: string, fieldId: string, transcript: string) => {
      if (!transcript.trim()) {
        return;
      }

      clearFinalizeState();

      if (sectionId === "tomorrow_setup") {
        setTomorrowError(null);
        setTomorrowPhase("idle");

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

      setSectionErrors((current) => ({
        ...current,
        [sectionId]: null,
      }));
      setSectionPhases((current) => ({
        ...current,
        [sectionId]: "idle",
      }));
      setSections((currentSections) => ({
        ...currentSections,
        [sectionId]: {
          [SECTION_FIELD_ID]: `${getSectionMemoValue(currentSections, sectionId)} ${transcript}`.trim(),
        },
      }));
      setRawTranscript((current) => `${current} ${transcript}`.trim());
    },
    [clearFinalizeState],
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
    clearFinalizeState();
    setSectionErrors((current) => ({
      ...current,
      [sectionId]: null,
    }));
    setSectionPhases((current) => ({
      ...current,
      [sectionId]: "idle",
    }));
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

  function getSectionStatusText(sectionId: string) {
    const phase = sectionPhases[sectionId] ?? "idle";

    if (phase === "saving") {
      return {
        tone: "default" as const,
        text: t("journal.sectionSaving"),
      };
    }

    if (phase === "error" && sectionErrors[sectionId]) {
      return {
        tone: "error" as const,
        text: sectionErrors[sectionId] ?? t("journal.saveError"),
      };
    }

    if (isSectionDirty(sectionId)) {
      return {
        tone: "default" as const,
        text: t("journal.unsavedChanges"),
      };
    }

    if (
      phase === "saved" ||
      getSectionMemoValue(savedSections, sectionId).trim().length > 0
    ) {
      return {
        tone: "success" as const,
        text: t("journal.sectionSaved"),
      };
    }

    return null;
  }

  function getTomorrowStatusText() {
    if (tomorrowPhase === "saving") {
      return {
        tone: "default" as const,
        text: t("journal.sectionSaving"),
      };
    }

    if (tomorrowPhase === "error" && tomorrowError) {
      return {
        tone: "error" as const,
        text: tomorrowError,
      };
    }

    if (isTomorrowDirty) {
      return {
        tone: "default" as const,
        text: t("journal.unsavedChanges"),
      };
    }

    const hasSavedTomorrowContent =
      savedTomorrowSetup.mainFocus.trim().length > 0 ||
      savedTomorrowSetup.topTasks.length > 0 ||
      savedTomorrowSetup.watchOutFor.trim().length > 0 ||
      savedTomorrowSetup.intention.trim().length > 0;

    if (tomorrowPhase === "saved" || hasSavedTomorrowContent) {
      return {
        tone: "success" as const,
        text: t("journal.tomorrowSaved"),
      };
    }

    return null;
  }

  async function persistSection(sectionId: string) {
    setSectionPhases((current) => ({
      ...current,
      [sectionId]: "saving",
    }));
    setSectionErrors((current) => ({
      ...current,
      [sectionId]: null,
    }));
    setSummaryError(null);

    try {
      const savedEntry = await onSaveSection(date, {
        sectionKey: sectionId,
        content: getSectionMemoValue(sections, sectionId),
        rawTranscript,
        editedTranscript: structuredJournalText,
      });
      const savedValue = savedEntry.sections[sectionId]?.memo ?? "";

      setSections((currentSections) => ({
        ...currentSections,
        [sectionId]: {
          [SECTION_FIELD_ID]: savedValue,
        },
      }));
      setSavedSections((currentSections) => ({
        ...currentSections,
        [sectionId]: {
          [SECTION_FIELD_ID]: savedValue,
        },
      }));
      setRawTranscript(savedEntry.rawTranscript ?? rawTranscript);
      setSummaryText(savedEntry.aiSummary ?? "");
      setSummaryError(savedEntry.aiSummaryError ?? null);
      setSectionPhases((current) => ({
        ...current,
        [sectionId]: "saved",
      }));

      return savedEntry;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? translateRuntimeMessage(caughtError.message, language)
          : t("journal.saveError");

      setSectionErrors((current) => ({
        ...current,
        [sectionId]: message,
      }));
      setSectionPhases((current) => ({
        ...current,
        [sectionId]: "error",
      }));

      throw new Error(message);
    }
  }

  async function persistTomorrowSetup() {
    setTomorrowPhase("saving");
    setTomorrowError(null);
    setSummaryError(null);

    try {
      const savedEntry = await onSaveTomorrowSetup(date, {
        tomorrowSetup,
        rawTranscript,
        editedTranscript: structuredJournalText,
      });
      const nextTomorrowSetup = normalizeTomorrowSetupValue(savedEntry.tomorrowSetup);

      setTomorrowSetup(nextTomorrowSetup);
      setSavedTomorrowSetup(nextTomorrowSetup);
      setRawTranscript(savedEntry.rawTranscript ?? rawTranscript);
      setSummaryText(savedEntry.aiSummary ?? "");
      setSummaryError(savedEntry.aiSummaryError ?? null);
      setTomorrowPhase("saved");

      return savedEntry;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? translateRuntimeMessage(caughtError.message, language)
          : t("journal.saveError");

      setTomorrowError(message);
      setTomorrowPhase("error");

      throw new Error(message);
    }
  }

  async function saveDirtyDraftsBeforeFinalize() {
    const dirtySectionIds = templateSections
      .map((section) => section.id)
      .filter((sectionId) => isSectionDirty(sectionId));

    if (dirtySectionIds.length === 0 && !isTomorrowDirty) {
      return;
    }

    setFinalizePhase("saving-drafts");
    setFinalizeMessage(t("journal.finalizeSavingDrafts"));

    for (const sectionId of dirtySectionIds) {
      await persistSection(sectionId);
    }

    if (isTomorrowDirty) {
      await persistTomorrowSetup();
    }
  }

  async function finalizeEntry() {
    clearFinalizeState();
    setSummaryError(null);

    try {
      await saveDirtyDraftsBeforeFinalize();

      setFinalizePhase("finalizing");
      setFinalizeMessage(t("journal.finalizing"));

      const finalizedEntry = await onFinalize(date);
      const normalizedSavedSections = normalizeJournalSections(
        finalizedEntry.sections,
        journalConfig,
      );
      const normalizedTomorrowSetup = normalizeTomorrowSetupValue(
        finalizedEntry.tomorrowSetup,
      );

      setSections(normalizedSavedSections);
      setSavedSections(normalizedSavedSections);
      setTomorrowSetup(normalizedTomorrowSetup);
      setSavedTomorrowSetup(normalizedTomorrowSetup);
      setRawTranscript(finalizedEntry.rawTranscript ?? rawTranscript);
      setSummaryText(finalizedEntry.aiSummary ?? "");
      setSummaryError(finalizedEntry.aiSummaryError ?? null);
      setIsFinalized(true);
      setSectionPhases(
        Object.fromEntries(
          templateSections.map((section) => [
            section.id,
            getSectionMemoValue(normalizedSavedSections, section.id).trim().length > 0
              ? ("saved" as const)
              : ("idle" as const),
          ]),
        ),
      );
      setTomorrowPhase("saved");
      setTomorrowError(null);
      setFinalizePhase("saved");
      setFinalizeMessage(t("journal.finalizeSuccess"));
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? translateRuntimeMessage(caughtError.message, language)
          : t("journal.finalizeError");

      setFinalizePhase("error");
      setFinalizeMessage(message);
      setSummaryError(message);
    }
  }

  const tomorrowStatus = getTomorrowStatusText();

  return (
    <div className="space-y-5">
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
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[color:var(--muted)]">
          <span className="font-medium capitalize text-[color:var(--foreground)]">
            {translateSentiment(analysisPreview.sentiment, language)}
          </span>
          <span>{t("journal.mood", { value: analysisPreview.moodScore })}</span>
          <span>{t("journal.power", { value: analysisPreview.powerLevel })}</span>
        </div>

        {finalizeMessage ? (
          <p
            className={`mt-4 text-sm ${
              finalizePhase === "error"
                ? "app-text-danger"
                : "text-[color:var(--accent-strong)]"
            }`}
          >
            {finalizeMessage}
          </p>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            {t("journal.finalizeHint")}
          </p>
        )}
      </section>

      {templateSections.map((section, sectionIndex) => {
        const field = section.fields[0];
        const value = getSectionMemoValue(sections, section.id);
        const inputId = `${section.id}-${SECTION_FIELD_ID}`;
        const status = getSectionStatusText(section.id);

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
                {status ? (
                  <p
                    className={`mt-3 text-sm ${
                      status.tone === "error"
                        ? "app-text-danger"
                        : status.tone === "success"
                          ? "text-[color:var(--accent-strong)]"
                          : "text-[color:var(--muted)]"
                    }`}
                  >
                    {status.text}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
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

                <button
                  type="button"
                  onClick={() => void persistSection(section.id)}
                  disabled={
                    sectionPhases[section.id] === "saving" ||
                    isFinalizing ||
                    !isSectionDirty(section.id)
                  }
                  className="app-button-secondary text-sm"
                >
                  {sectionPhases[section.id] === "saving" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {sectionPhases[section.id] === "saving"
                    ? t("journal.sectionSaving")
                    : t("journal.sectionSave")}
                </button>
              </div>
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

      {journalConfig.tomorrowSetupEnabled ? (
        <TomorrowSetupPanel
          mode="edit"
          value={tomorrowSetup}
          onChange={updateTomorrow}
          voice={voice}
          activeVoiceTarget={activeVoiceTarget}
          onStartVoice={onStartVoice}
          onCancelVoice={onCancelVoice}
          onStopVoice={onStopVoice}
          onResetVoice={onResetVoice}
          statusText={tomorrowStatus?.text ?? null}
          statusTone={tomorrowStatus?.tone ?? "default"}
          isSaving={tomorrowPhase === "saving"}
          isSaveDisabled={tomorrowPhase === "saving" || isFinalizing || !isTomorrowDirty}
          onSave={() => void persistTomorrowSetup()}
        />
      ) : null}

      <section className="app-surface app-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <Sparkles className="h-4 w-4 text-[color:var(--accent-strong)]" />
            {t("journal.aiSummary")}
          </div>

          <button
            type="button"
            onClick={() => void finalizeEntry()}
            disabled={!canFinalize || voice.isBusy}
            className="app-button-primary text-sm"
          >
            {isFinalizing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isFinalizing
              ? t("journal.finalizing")
              : isFinalized
                ? t("journal.finalizeAgain")
                : t("journal.finalize")}
          </button>
        </div>

        <p className="mt-3 text-sm leading-5 text-[color:var(--muted)]">
          {t("journal.summaryDraftHint")}
        </p>

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
                      updateTomorrow({
                        ...tomorrowSetup,
                        watchOutFor: tomorrowSetup.watchOutFor
                          ? `${tomorrowSetup.watchOutFor} ${suggestion.text}`.trim()
                          : suggestion.text,
                      })
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
    </div>
  );
}
