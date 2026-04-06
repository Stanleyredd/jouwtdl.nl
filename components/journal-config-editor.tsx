"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  createCustomJournalSection,
  createPresetJournalConfig,
  getEnabledJournalConfigSections,
  getJournalPresetOptions,
  normalizeJournalConfig,
} from "@/lib/journal-config";
import { useLanguage } from "@/hooks/use-language";
import { translateRuntimeMessage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { JournalConfig, JournalConfigSection, JournalPreset } from "@/types";

interface JournalConfigEditorProps {
  mode: "setup" | "settings";
  initialPreset: JournalPreset;
  initialConfig: JournalConfig;
  onSave: (input: {
    journalPreset: JournalPreset;
    journalConfig: JournalConfig;
    onboardingCompleted: boolean;
  }) => Promise<{ error: string | null }>;
}

const DEFAULT_SECTION_ROWS = 5;

function reindexSections(sections: JournalConfigSection[]) {
  return sections.map((section, index) => ({
    ...section,
    order: index + 1,
  }));
}

export function JournalConfigEditor({
  mode,
  initialPreset,
  initialConfig,
  onSave,
}: JournalConfigEditorProps) {
  const { language, t } = useLanguage();
  const [journalPreset, setJournalPreset] = useState<JournalPreset>(initialPreset);
  const [journalConfig, setJournalConfig] = useState<JournalConfig>(
    normalizeJournalConfig(initialConfig, language, initialPreset),
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const presetOptions = useMemo(() => getJournalPresetOptions(language), [language]);
  const sections = useMemo(
    () => reindexSections(normalizeJournalConfig(journalConfig, language, journalPreset).sections),
    [journalConfig, journalPreset, language],
  );
  const enabledSections = getEnabledJournalConfigSections({
    ...journalConfig,
    sections,
  });

  function updateSection(
    sectionId: string,
    updates: Partial<JournalConfigSection>,
  ) {
    setJournalConfig((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section,
      ),
    }));
  }

  function moveSection(sectionId: string, direction: "up" | "down") {
    setJournalConfig((current) => {
      const ordered = reindexSections([...current.sections]);
      const index = ordered.findIndex((section) => section.id === sectionId);

      if (index === -1) {
        return current;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= ordered.length) {
        return current;
      }

      const nextSections = [...ordered];
      const [section] = nextSections.splice(index, 1);
      nextSections.splice(nextIndex, 0, section);

      return {
        ...current,
        sections: reindexSections(nextSections),
      };
    });
  }

  function addSection() {
    setJournalConfig((current) => ({
      ...current,
      sections: [
        ...reindexSections(current.sections),
        createCustomJournalSection(language, current.sections.length + 1),
      ],
    }));
  }

  function removeSection(sectionId: string) {
    setJournalConfig((current) => ({
      ...current,
      sections: reindexSections(
        current.sections.filter((section) => section.id !== sectionId),
      ),
    }));
  }

  function replacePreset(nextPreset: JournalPreset) {
    if (nextPreset === journalPreset) {
      return;
    }

    const shouldReplace =
      mode === "setup" ||
      window.confirm(t("journalSetup.replacePresetConfirm"));

    if (!shouldReplace) {
      return;
    }

    setJournalPreset(nextPreset);
    setJournalConfig(createPresetJournalConfig(nextPreset, language));
    setStatus("idle");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedConfig = normalizeJournalConfig(
      {
        ...journalConfig,
        sections,
      },
      language,
      journalPreset,
    );

    setStatus("saving");
    setMessage("");

    const result = await onSave({
      journalPreset,
      journalConfig: normalizedConfig,
      onboardingCompleted: true,
    });

    if (result.error) {
      setStatus("error");
      setMessage(translateRuntimeMessage(result.error, language));
      return;
    }

    setStatus("saved");
    setMessage(t("journalSetup.saved"));
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <section className="app-surface app-panel">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          {t("journalSetup.choosePreset")}
        </p>
        <p className="mt-1 text-sm leading-5 text-[color:var(--muted)]">
          {t("journalSetup.choosePresetHint")}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {presetOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => replacePreset(option.id)}
              className={cn(
                "app-surface-soft rounded-[20px] border px-4 py-4 text-left transition",
                journalPreset === option.id
                  ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-soft)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--border-strong)]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {option.title}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--muted)]">
                    {option.description}
                  </p>
                </div>
                {journalPreset === option.id ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent-ink)]" />
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="app-surface app-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("journalSetup.sections")}
            </p>
            <p className="mt-1 text-sm leading-5 text-[color:var(--muted)]">
              {t("journalSetup.sectionsHint")}
            </p>
          </div>
          <button type="button" onClick={addSection} className="app-button-secondary text-sm">
            <Plus className="h-4 w-4" />
            {t("journalSetup.addSection")}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {sections.map((section, index) => (
            <article key={section.id} className="app-surface-soft rounded-[20px] p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {t("journalSetup.sectionNumber", { number: index + 1 })}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {section.id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveSection(section.id, "up")}
                    className="app-icon-button"
                    disabled={index === 0}
                    aria-label={t("journalSetup.moveUp")}
                    title={t("journalSetup.moveUp")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(section.id, "down")}
                    className="app-icon-button"
                    disabled={index === sections.length - 1}
                    aria-label={t("journalSetup.moveDown")}
                    title={t("journalSetup.moveDown")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(section.id)}
                    className="app-icon-button"
                    aria-label={t("journalSetup.removeSection")}
                    title={t("journalSetup.removeSection")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[color:var(--foreground)]">
                    {t("journalSetup.sectionTitle")}
                  </span>
                  <input
                    value={section.title}
                    onChange={(event) =>
                      updateSection(section.id, { title: event.target.value })
                    }
                    className="app-input"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[color:var(--foreground)]">
                    {t("journalSetup.sectionDescription")}
                  </span>
                  <input
                    value={section.description}
                    onChange={(event) =>
                      updateSection(section.id, { description: event.target.value })
                    }
                    className="app-input"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[color:var(--foreground)]">
                    {t("journalSetup.sectionPlaceholder")}
                  </span>
                  <textarea
                    rows={3}
                    value={section.placeholder}
                    onChange={(event) =>
                      updateSection(section.id, { placeholder: event.target.value })
                    }
                    className="app-input"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">
                      {t("journalSetup.rows")}
                    </span>
                    <input
                      type="number"
                      min={3}
                      max={12}
                      value={section.rows}
                      onChange={(event) =>
                        updateSection(section.id, {
                          rows: Number(event.target.value) || DEFAULT_SECTION_ROWS,
                        })
                      }
                      className="app-input"
                    />
                  </label>

                  <label className="app-surface rounded-[18px] px-4 py-3 text-sm text-[color:var(--foreground)]">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) =>
                          updateSection(section.id, { enabled: event.target.checked })
                        }
                      />
                      <span>{t("journalSetup.sectionEnabled")}</span>
                    </span>
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="app-surface app-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("journalSetup.tomorrowSection")}
            </p>
            <p className="mt-1 text-sm leading-5 text-[color:var(--muted)]">
              {t("journalSetup.tomorrowSectionHint")}
            </p>
          </div>

          <label className="app-surface-soft rounded-[18px] px-4 py-3 text-sm text-[color:var(--foreground)]">
            <span className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={journalConfig.tomorrowSetupEnabled}
                onChange={(event) =>
                  setJournalConfig((current) => ({
                    ...current,
                    tomorrowSetupEnabled: event.target.checked,
                  }))
                }
              />
              <span>{t("journalSetup.enabled")}</span>
            </span>
          </label>
        </div>
      </section>

      <section className="app-surface app-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {t("journalSetup.preview")}
            </p>
            <p className="mt-1 text-sm leading-5 text-[color:var(--muted)]">
              {t("journalSetup.previewHint", { count: enabledSections.length })}
            </p>
          </div>

          <button
            type="submit"
            disabled={status === "saving"}
            className="app-button-primary text-sm"
          >
            <Save className="h-4 w-4" />
            {status === "saving" ? t("journalSetup.saving") : t("journalSetup.save")}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {enabledSections.map((section) => (
            <div key={section.id} className="app-surface-soft rounded-[18px] px-4 py-3">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {section.title}
              </p>
              {section.description ? (
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  {section.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {message ? (
          <p
            className={cn(
              "mt-4 text-sm",
              status === "error"
                ? "app-text-danger"
                : "text-[color:var(--accent-strong)]",
            )}
          >
            {message}
          </p>
        ) : null}
      </section>
    </form>
  );
}
