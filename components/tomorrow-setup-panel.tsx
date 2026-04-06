"use client";

import { type ReactNode, useMemo } from "react";

import { useLanguage } from "@/hooks/use-language";
import { type VoiceResult } from "@/hooks/use-voice-transcription";
import type { TomorrowSetup } from "@/types";
import { VoiceRecorderButton } from "@/components/voice-recorder-button";

interface TomorrowSetupPanelProps {
  value: TomorrowSetup;
  mode?: "edit" | "preview";
  onChange?: (nextValue: TomorrowSetup) => void;
  voice?: VoiceResult;
  activeVoiceTarget?: {
    sectionId: string;
    fieldId: string;
  } | null;
  onStartVoice?: (sectionId: string, fieldId: string) => void;
  onCancelVoice?: () => void;
  onStopVoice?: () => void;
  onResetVoice?: (sectionId: string, fieldId: string) => void;
}

export function TomorrowSetupPanel({
  value,
  mode = "preview",
  onChange,
  voice,
  activeVoiceTarget,
  onStartVoice,
  onCancelVoice,
  onStopVoice,
  onResetVoice,
}: TomorrowSetupPanelProps) {
  const { t } = useLanguage();
  const topTasksText = useMemo(
    () => value.topTasks.filter(Boolean).join("\n"),
    [value.topTasks],
  );

  function updateTopTasks(nextValue: string) {
    onChange?.({
      ...value,
      topTasks: nextValue
        .split("\n")
        .map((task) => task.trim())
        .filter(Boolean),
    });
  }

  function isVoiceActive(fieldId: string) {
    return activeVoiceTarget?.sectionId === "tomorrow_setup" && activeVoiceTarget.fieldId === fieldId;
  }

  if (mode === "preview") {
    return (
      <section className="app-surface app-panel">
        <p className="app-label">{t("journal.tomorrow")}</p>
        <div className="mt-4 space-y-3">
          <PreviewItem label={t("journal.tomorrowFocus")} value={value.mainFocus} />
          <PreviewItem
            label={t("journal.tomorrowTopTasksPreview")}
            value={value.topTasks.filter(Boolean).join(" · ")}
          />
          <PreviewItem label={t("journal.tomorrowWatch")} value={value.watchOutFor} />
          <PreviewItem label={t("journal.tomorrowIntention")} value={value.intention} />
        </div>
      </section>
    );
  }

  return (
    <section className="app-surface app-panel">
      <p className="text-sm font-medium text-[color:var(--foreground)]">
        {t("journal.tomorrow")}
      </p>

      <div className="mt-4 grid gap-4">
        <MemoField
          label={t("journal.tomorrowFocus")}
          value={value.mainFocus}
          onChange={(next) => onChange?.({ ...value, mainFocus: next })}
          placeholder={t("journal.tomorrowFocusPlaceholder")}
          voiceButton={
            voice && onStartVoice && onCancelVoice && onStopVoice && onResetVoice ? (
              <VoiceRecorderButton
                compact
                fieldId="tomorrow_setup-mainFocus"
                status={voice.status}
                supported={voice.supported}
                transcript={voice.transcript}
                error={voice.error}
                language={voice.language}
                recordingSeconds={voice.recordingSeconds}
                isActive={isVoiceActive("mainFocus")}
                isBusy={voice.isBusy}
                isDisabled={voice.isBusy && !isVoiceActive("mainFocus")}
                onStart={() => onStartVoice("tomorrow_setup", "mainFocus")}
                onStop={onStopVoice}
                onCancel={onCancelVoice}
                onReset={() => onResetVoice("tomorrow_setup", "mainFocus")}
              />
            ) : null
          }
        />
        <MemoField
          label={t("journal.tomorrowTopTasks")}
          value={topTasksText}
          onChange={updateTopTasks}
          placeholder={t("journal.tomorrowTopTasksPlaceholder")}
          voiceButton={
            voice && onStartVoice && onCancelVoice && onStopVoice && onResetVoice ? (
              <VoiceRecorderButton
                compact
                fieldId="tomorrow_setup-topTasks"
                status={voice.status}
                supported={voice.supported}
                transcript={voice.transcript}
                error={voice.error}
                language={voice.language}
                recordingSeconds={voice.recordingSeconds}
                isActive={isVoiceActive("topTasks")}
                isBusy={voice.isBusy}
                isDisabled={voice.isBusy && !isVoiceActive("topTasks")}
                onStart={() => onStartVoice("tomorrow_setup", "topTasks")}
                onStop={onStopVoice}
                onCancel={onCancelVoice}
                onReset={() => onResetVoice("tomorrow_setup", "topTasks")}
              />
            ) : null
          }
        />
        <MemoField
          label={t("journal.tomorrowWatch")}
          value={value.watchOutFor}
          onChange={(next) => onChange?.({ ...value, watchOutFor: next })}
          placeholder={t("journal.tomorrowWatchPlaceholder")}
        />
        <MemoField
          label={t("journal.tomorrowIntention")}
          value={value.intention}
          onChange={(next) => onChange?.({ ...value, intention: next })}
          placeholder={t("journal.tomorrowIntentionPlaceholder")}
        />
      </div>
    </section>
  );
}

function MemoField({
  label,
  value,
  onChange,
  placeholder,
  voiceButton,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  voiceButton?: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--foreground)]">{label}</span>
        {voiceButton}
      </div>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="app-input"
      />
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  const { t } = useLanguage();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-soft)]">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-[color:var(--foreground)]">
        {value || t("common.notSet")}
      </p>
    </div>
  );
}
