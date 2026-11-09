"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";

import { VoiceRecorderButton } from "@/components/voice-recorder-button";
import { useLanguage } from "@/hooks/use-language";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import {
  IDEA_CONTENT_LIMIT, IDEA_TITLE_LIMIT, ideaCategories, ideaPriorities, ideaStatuses,
  type IdeaEntry, type IdeaFields,
} from "@/lib/ideas";
import { deleteIdea, saveIdea } from "@/services/idea-entry-api-service";

const emptyIdea: IdeaFields = {
  title: "", content: "", category: "other", priority: "normal", status: "unprocessed",
};

export function IdeaSelect<T extends string>({
  field, options, value, onChange, all = false,
}: {
  field: "category" | "status" | "priority" | "sort";
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  all?: boolean;
}) {
  const { t } = useLanguage();
  const id = useId();
  return (
    <div className="grid min-w-0 gap-2 text-sm font-medium">
      <label htmlFor={id}>{t(`ideas.${field}`)}</label>
      <select
        id={id}
        className="app-input text-base sm:text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {all && <option value="">{t("ideas.all")}</option>}
        {options.map((option) => (
          <option key={option} value={option}>{t(`ideas.${field}.${option}`)}</option>
        ))}
      </select>
    </div>
  );
}

export function IdeaEditor({
  idea, onClose, onSaved, onDeleted,
}: {
  idea?: IdeaEntry;
  onClose: () => void;
  onSaved: (idea: IdeaEntry) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [fields, setFields] = useState<IdeaFields>(idea ?? emptyIdea);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const voice = useVoiceTranscription((transcript) => {
    const text = transcript.trim();
    if (text) {
      setFields((current) => ({
        ...current,
        content: current.content.trimEnd() ? `${current.content.trimEnd()}\n\n${text}` : text,
      }));
    }
  });

  useEffect(() => {
    titleInput.current?.focus();
  }, []);

  function change<K extends keyof IdeaFields>(field: K, value: IdeaFields[K]) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || voice.isBusy) return;
    if (!fields.title.trim() || !fields.content.trim() ||
      fields.title.trim().length > IDEA_TITLE_LIMIT || fields.content.trim().length > IDEA_CONTENT_LIMIT) {
      setError("ideas.invalid");
      return;
    }
    setPending("save");
    setError(null);
    try {
      onSaved(await saveIdea(fields, idea?.id));
    } catch {
      setError("ideas.saveError");
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    if (!idea || pending || voice.isBusy || !window.confirm(t("ideas.confirmDelete"))) return;
    setPending("delete");
    setError(null);
    try {
      await deleteIdea(idea.id);
      onDeleted(idea.id);
    } catch {
      setError("ideas.deleteError");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="app-surface-strong app-panel-lg" aria-labelledby="idea-editor-heading">
      <h2 id="idea-editor-heading" className="mb-4 text-lg font-semibold">
        {t(idea ? "ideas.edit" : "ideas.new")}
      </h2>
      <form onSubmit={handleSave}>
        <fieldset disabled={pending !== null} className="min-w-0 space-y-4">
          <label className="grid gap-2 text-sm font-medium">
            <span>{t("ideas.title")}</span>
            <input
              ref={titleInput}
              className="app-input text-base sm:text-sm"
              value={fields.title}
              onChange={(event) => change("title", event.target.value)}
              maxLength={IDEA_TITLE_LIMIT}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t("ideas.content")}</span>
            <textarea
              id="idea-content"
              className="app-input min-h-32 text-base sm:text-sm"
              rows={5}
              value={fields.content}
              onChange={(event) => change("content", event.target.value)}
              maxLength={IDEA_CONTENT_LIMIT}
              required
            />
          </label>
          <VoiceRecorderButton
            compact
            fieldId="idea-content"
            status={voice.status}
            supported={voice.supported}
            transcript={voice.transcript}
            error={voice.error}
            language={voice.language}
            recordingSeconds={voice.recordingSeconds}
            isActive
            isBusy={voice.isBusy}
            onStart={voice.start}
            onStop={voice.stop}
            onCancel={voice.reset}
            onReset={voice.reset}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <IdeaSelect field="category" options={ideaCategories} value={fields.category} onChange={(value) => change("category", value)} />
            <IdeaSelect field="priority" options={ideaPriorities} value={fields.priority} onChange={(value) => change("priority", value)} />
            {idea && <IdeaSelect field="status" options={ideaStatuses} value={fields.status} onChange={(value) => change("status", value)} />}
          </div>
          {error && <p role="alert" className="app-text-danger text-sm">{t(error)}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={voice.isBusy} className="app-button-primary text-sm">
              {t(pending === "save" ? "ideas.saving" : "common.save")}
            </button>
            <button type="button" className="app-button-secondary text-sm" onClick={onClose}>
              {t("common.cancel")}
            </button>
            {idea && (
              <button
                type="button"
                className="app-button-secondary app-text-danger text-sm sm:ml-auto"
                onClick={() => void handleDelete()}
                disabled={voice.isBusy}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {t(pending === "delete" ? "common.loading" : "ideas.delete")}
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
