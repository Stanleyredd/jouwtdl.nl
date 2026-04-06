"use client";

import { useEffect } from "react";
import { LoaderCircle, Mic, Square, Waves } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import { translateRuntimeMessage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type VoiceButtonStatus =
  | "idle"
  | "requesting-permission"
  | "preparing-recorder"
  | "recording"
  | "stopping"
  | "uploading"
  | "transcribing"
  | "success"
  | "unsupported"
  | "error";

interface VoiceRecorderButtonProps {
  compact?: boolean;
  fieldId: string;
  status: VoiceButtonStatus;
  supported: boolean;
  transcript: string;
  error: string | null;
  language: string;
  recordingSeconds: number;
  isActive: boolean;
  isBusy: boolean;
  isDisabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onReset: () => void;
}

export function VoiceRecorderButton({
  compact = false,
  fieldId,
  status,
  supported,
  transcript,
  error,
  language,
  recordingSeconds,
  isActive,
  isBusy,
  isDisabled = false,
  onStart,
  onStop,
  onCancel,
  onReset,
}: VoiceRecorderButtonProps) {
  const { t, language: appLanguage } = useLanguage();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    console.debug("[voice-button]", "voice-button-mounted", { fieldId });

    return () => {
      console.debug("[voice-button]", "voice-button-unmounted", { fieldId });
    };
  }, [fieldId]);

  if (!supported) {
    return compact ? (
      <span className="text-xs text-[color:var(--muted)]">{t("voice.noVoice")}</span>
    ) : (
      <div className="rounded-[18px] border border-dashed border-[color:var(--border)] px-4 py-3 text-xs leading-5 text-[color:var(--muted)]">
        {t("voice.unsupported")}
      </div>
    );
  }

  const effectiveStatus = isActive ? status : "idle";
  const effectiveTranscript = isActive ? transcript.trim() : "";
  const effectiveError = isActive ? error : null;
  const isRequestingPermission = effectiveStatus === "requesting-permission";
  const isPreparingRecorder = effectiveStatus === "preparing-recorder";
  const isRecording = effectiveStatus === "recording";
  const isStopping = effectiveStatus === "stopping";
  const isUploading = effectiveStatus === "uploading";
  const isTranscribing = effectiveStatus === "transcribing";
  const canCancelStartup = isRequestingPermission || isPreparingRecorder;
  const canReset = effectiveTranscript.length > 0 && !isBusy;
  const statusText = isRequestingPermission
    ? t("voice.waitingPermission")
    : isPreparingRecorder
      ? t("voice.preparingRecorder")
      : isRecording
        ? t("voice.recordingTime", { time: formatRecordingTime(recordingSeconds) })
        : isStopping
          ? t("voice.stopping")
          : isUploading
            ? t("voice.uploading")
            : isTranscribing
              ? t("voice.transcribing")
              : effectiveStatus === "success"
                ? t("voice.ready")
                : null;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={isRecording ? onStop : onStart}
          disabled={isDisabled || canCancelStartup || isStopping || isUploading || isTranscribing}
          title={isRecording ? t("voice.stopRecording") : t("voice.startRecording")}
          aria-label={isRecording ? t("voice.stopRecording") : t("voice.startRecording")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
            isRecording
              ? "border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent-ink)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-overlay)] text-[color:var(--foreground)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)]",
            compact ? "px-3 py-2 text-xs" : "",
          )}
        >
          {canCancelStartup || isStopping || isUploading || isTranscribing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {isRecording
            ? t("voice.stop")
            : isRequestingPermission
              ? t("voice.waitingShort")
              : isPreparingRecorder
                ? t("voice.preparingShort")
                : isStopping
                  ? t("voice.stopping")
                  : isUploading
                    ? t("voice.uploading")
                    : isTranscribing
                      ? t("voice.transcribing")
                      : effectiveStatus === "success"
                        ? compact
                          ? t("voice.recordAgain")
                          : t("voice.ready")
                        : effectiveError
                          ? t("voice.retry")
                          : compact
                            ? t("voice.record")
                            : t("voice.startRecording")}
        </button>

        {statusText ? (
          <span className="text-xs text-[color:var(--muted)]">{statusText}</span>
        ) : null}

        {canReset ? (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-[color:var(--muted)] underline-offset-4 hover:underline"
          >
            {t("voice.clear")}
          </button>
        ) : null}

        {effectiveError ? (
          <button
            type="button"
            onClick={onStart}
            className="text-xs text-[color:var(--muted)] underline-offset-4 hover:underline"
          >
            {t("voice.retry")}
          </button>
        ) : null}

        {canCancelStartup ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[color:var(--muted)] underline-offset-4 hover:underline"
          >
            {t("voice.cancel")}
          </button>
        ) : null}
      </div>

      {!compact ? (
        <p className="text-xs leading-5 text-[color:var(--muted)]">
          {t("voice.recordsLocally", { language })}
        </p>
      ) : null}

      {!compact && effectiveTranscript ? (
        <div className="app-surface-soft rounded-[18px] px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            <Waves className="h-3.5 w-3.5" />
            Preview
          </div>
          {effectiveTranscript}
        </div>
      ) : null}

      {effectiveError ? (
        <p aria-live="polite" className="text-xs leading-5 text-[color:var(--muted)]">
          {translateRuntimeMessage(effectiveError, appLanguage)}
        </p>
      ) : null}
    </div>
  );
}

function formatRecordingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");

  return `Recording ${minutes}:${remainingSeconds}`;
}
