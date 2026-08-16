"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, PencilLine, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { VoiceRecorderButton } from "@/components/voice-recorder-button";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import { formatLongDate, toDateKey } from "@/lib/date";
import { translateRuntimeMessage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  createDreamEntry,
  deleteDreamEntryById,
  listDreamEntries,
  updateDreamEntryById,
} from "@/services/dream-entry-api-service";
import type { DreamEntry, DreamSource } from "@/types";

interface DreamFormState {
  title: string;
  content: string;
  dreamDate: string;
  source: DreamSource;
}

function createEmptyDreamForm(): DreamFormState {
  return {
    title: "",
    content: "",
    dreamDate: toDateKey(new Date()),
    source: "text",
  };
}

export default function DreamsPage() {
  const { t, language } = useLanguage();
  const { isProfileReady, profileError } = useAuth();
  const [dreams, setDreams] = useState<DreamEntry[]>([]);
  const [form, setForm] = useState<DreamFormState>(createEmptyDreamForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voice = useVoiceTranscription((transcript) => {
    setForm((current) => ({
      ...current,
      content: transcript,
      source: "voice",
    }));
    setFeedback(t("dreams.voiceCaptured"));
    setError(null);
  });

  useEffect(() => {
    if (!isProfileReady) {
      return;
    }

    let cancelled = false;

    async function loadDreams() {
      setIsLoading(true);
      setError(null);

      try {
        const nextDreams = await listDreamEntries();

        if (cancelled) {
          return;
        }

        setDreams(nextDreams);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setError(
          caughtError instanceof Error ? caughtError.message : t("dreams.loadError"),
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDreams();

    return () => {
      cancelled = true;
    };
  }, [isProfileReady, t]);

  const isEditing = editingId !== null;
  const saveLabel = isSaving
    ? isEditing
      ? t("dreams.updating")
      : t("dreams.saving")
    : isEditing
      ? t("dreams.update")
      : t("dreams.save");

  const sortedDreams = useMemo(() => {
    return [...dreams].sort((left, right) => {
      if (left.dreamDate !== right.dreamDate) {
        return right.dreamDate.localeCompare(left.dreamDate);
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [dreams]);

  function updateFormField<Key extends keyof DreamFormState>(
    key: Key,
    value: DreamFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetComposer() {
    setEditingId(null);
    setForm(createEmptyDreamForm());
    voice.reset();
    setFeedback(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        title: form.title,
        content: form.content,
        dreamDate: form.dreamDate,
        source: form.source,
      };

      const savedDream = editingId
        ? await updateDreamEntryById(editingId, payload)
        : await createDreamEntry(payload);

      setDreams((current) => {
        const withoutCurrent = current.filter((dream) => dream.id !== savedDream.id);
        return [savedDream, ...withoutCurrent];
      });

      setFeedback(isEditing ? t("dreams.updated") : t("dreams.saved"));
      setEditingId(null);
      setForm(createEmptyDreamForm());
      voice.reset();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : isEditing
            ? t("dreams.updateError")
            : t("dreams.saveError"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(dream: DreamEntry) {
    setEditingId(dream.id);
    setForm({
      title: dream.title,
      content: dream.content,
      dreamDate: dream.dreamDate,
      source: dream.source,
    });
    voice.reset();
    setFeedback(null);
    setError(null);
  }

  async function handleDelete(dream: DreamEntry) {
    setDeletingId(dream.id);
    setError(null);
    setFeedback(null);

    try {
      await deleteDreamEntryById(dream.id);
      setDreams((current) => current.filter((entry) => entry.id !== dream.id));

      if (editingId === dream.id) {
        setEditingId(null);
        setForm(createEmptyDreamForm());
        voice.reset();
      }

      setFeedback(t("dreams.deleted"));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : t("dreams.deleteError"),
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (!isProfileReady) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow={t("dreams.eyebrow")}
          title={t("dreams.title")}
          description={t("dreams.loading")}
        />
        <section className="app-surface-strong app-panel-lg">
          <div className="h-8 w-40 rounded-2xl bg-[color:var(--surface-soft)]" />
          <div className="mt-4 h-28 rounded-[22px] bg-[color:var(--surface-soft)]" />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("dreams.eyebrow")}
        title={t("dreams.title")}
        description={t("dreams.description")}
      />

      {profileError ? (
        <section className="app-surface app-panel text-sm text-[color:var(--muted)]">
          {translateRuntimeMessage(profileError, language)}
        </section>
      ) : null}

      {error ? (
        <section className="app-surface app-panel text-sm text-[color:var(--muted)]">
          {translateRuntimeMessage(error, language)}
        </section>
      ) : null}

      {feedback ? (
        <section className="app-surface app-panel text-sm text-[color:var(--muted)]">
          {feedback}
        </section>
      ) : null}

      <section className="app-surface-strong app-panel-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("dreams.captureTitle")}
            </p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
              {t("dreams.captureHint")}
            </p>
          </div>

          {isEditing ? (
            <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-overlay)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--muted)]">
              {t("common.edit")}
            </span>
          ) : null}
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="app-surface rounded-[24px] p-5">
            <VoiceRecorderButton
              fieldId="dream-content"
              status={voice.status}
              supported={voice.supported}
              transcript={voice.transcript}
              error={voice.error}
              language={voice.language}
              recordingSeconds={voice.recordingSeconds}
              isActive
              isBusy={voice.isBusy}
              isDisabled={isSaving}
              onStart={voice.start}
              onStop={voice.stop}
              onCancel={voice.reset}
              onReset={voice.reset}
            />

            <p className="mt-4 text-xs leading-5 text-[color:var(--muted)]">
              {t("dreams.typeHint")}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">
                {t("dreams.titleLabel")}
              </span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateFormField("title", event.target.value)}
                placeholder={t("dreams.titlePlaceholder")}
                className="app-input"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">
                {t("dreams.dateLabel")}
              </span>
              <input
                type="date"
                value={form.dreamDate}
                onChange={(event) => updateFormField("dreamDate", event.target.value)}
                className="app-input"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">
              {t("dreams.contentLabel")}
            </span>
            <textarea
              id="dream-content"
              rows={10}
              value={form.content}
              onChange={(event) => updateFormField("content", event.target.value)}
              placeholder={t("dreams.contentPlaceholder")}
              className="app-input min-h-[220px]"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving || voice.isBusy}
              className="app-button-primary text-sm"
            >
              {saveLabel}
            </button>

            {isEditing ? (
              <button
                type="button"
                onClick={resetComposer}
                className="app-button-secondary text-sm"
              >
                {t("dreams.cancelEdit")}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {t("dreams.recent")}
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
            {t("dreams.recentHint")}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <section key={index} className="app-surface app-panel h-36" />
            ))}
          </div>
        ) : sortedDreams.length > 0 ? (
          <div className="space-y-3">
            {sortedDreams.map((dream) => {
              const deleting = deletingId === dream.id;
              const displayTitle =
                dream.title.trim() ||
                t("dreams.fallbackTitle", {
                  date: formatLongDate(dream.dreamDate, language),
                });

              return (
                <article key={dream.id} className="app-surface app-panel">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                        <span>{formatLongDate(dream.dreamDate, language)}</span>
                        <span>·</span>
                        <span>{t(`dreams.source.${dream.source}`)}</span>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                        {displayTitle}
                      </h2>
                      <p className="mt-2 line-clamp-4 text-sm leading-6 text-[color:var(--muted)]">
                        {dream.content}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(dream)}
                        className={cn(
                          "app-icon-button h-10 w-10",
                          editingId === dream.id
                            ? "border-[color:var(--border-strong)] bg-[color:var(--surface-overlay-strong)]"
                            : "",
                        )}
                        aria-label={t("dreams.edit")}
                        title={t("dreams.edit")}
                      >
                        <PencilLine className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(dream)}
                        disabled={deleting}
                        className="app-icon-button h-10 w-10"
                        aria-label={t("dreams.delete")}
                        title={t("dreams.delete")}
                      >
                        {deleting ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={t("dreams.none")}
            description={t("dreams.noneHint")}
          />
        )}
      </section>
    </div>
  );
}
