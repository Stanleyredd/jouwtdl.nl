"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { IdeaEditor, IdeaSelect } from "@/components/idea-fields";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import {
  defaultIdeaFilters, ideaCategories, ideaPriorities, ideaSorts, ideaStatuses, selectIdeas,
  type IdeaEntry, type IdeaFilters,
} from "@/lib/ideas";
import { listIdeas } from "@/services/idea-entry-api-service";

export default function IdeasPage() {
  const { isReady, user } = useAuth();
  const { t } = useLanguage();

  if (isReady && user) return <IdeasWorkspace key={user.id} />;

  return <PageHeader eyebrow={t("app.name")} title={t("nav.ideas")} description={t(isReady ? "ideas.signIn" : "common.loading")} />;
}

function IdeasWorkspace() {
  const { t, language } = useLanguage();
  const [ideas, setIdeas] = useState<IdeaEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [editor, setEditor] = useState<IdeaEntry | "new" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [filters, setFilters] = useState(defaultIdeaFilters);
  const newButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    listIdeas(controller.signal).then(
      (entries) => { if (!controller.signal.aborted) setIdeas(entries); },
      () => { if (!controller.signal.aborted) setLoadError(true); },
    );
    return () => controller.abort();
  }, [loadAttempt]);

  function changeFilter<K extends keyof IdeaFilters>(field: K, value: IdeaFilters[K]) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function openEditor(entry: IdeaEntry | "new") {
    setFeedback(null);
    setEditor(entry);
  }

  function closeEditor() {
    setEditor(null);
    requestAnimationFrame(() => newButton.current?.focus({ preventScroll: true }));
  }

  const visibleIdeas = selectIdeas(ideas ?? [], filters);
  const dateFormat = new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", { dateStyle: "medium" });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("app.name")}
        title={t("nav.ideas")}
        description={t("ideas.description")}
        action={
          <button
            ref={newButton}
            type="button"
            className="app-button-primary text-sm"
            disabled={ideas === null || editor !== null}
            onClick={() => openEditor("new")}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t("ideas.new")}
          </button>
        }
      />
      {editor && (
        <IdeaEditor
          key={editor === "new" ? "new" : editor.id}
          idea={editor === "new" ? undefined : editor}
          onClose={closeEditor}
          onSaved={(saved) => {
            setIdeas((current) => [saved, ...(current ?? []).filter((idea) => idea.id !== saved.id)]);
            setFeedback("common.saved");
            closeEditor();
          }}
          onDeleted={(id) => {
            setIdeas((current) => (current ?? []).filter((idea) => idea.id !== id));
            setFeedback("ideas.deleted");
            closeEditor();
          }}
        />
      )}
      {feedback && <p role="status" className="text-sm text-[color:var(--muted)]">{t(feedback)}</p>}
      {loadError ? (
        <div className="app-surface app-panel space-y-3">
          <p role="alert">{t("ideas.loadError")}</p>
          <button type="button" className="app-button-secondary text-sm" onClick={() => {
            setLoadError(false);
            setLoadAttempt((attempt) => attempt + 1);
          }}>
            {t("common.retry")}
          </button>
        </div>
      ) : ideas === null ? (
        <p role="status" className="app-surface app-panel">{t("common.loading")}</p>
      ) : ideas.length === 0 ? (
        <div className="space-y-3">
          <EmptyState title={t("ideas.empty")} description={t("ideas.description")} />
          {!editor && (
            <button type="button" className="app-button-secondary text-sm" onClick={() => openEditor("new")}>
              {t("ideas.first")}
            </button>
          )}
        </div>
      ) : (
        <>
          <section className="app-surface app-panel space-y-3">
            <label className="relative block">
              <span className="sr-only">{t("ideas.search")}</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                type="search"
                className="app-input pl-11! text-base sm:text-sm"
                placeholder={t("ideas.search")}
                value={filters.query}
                onChange={(event) => changeFilter("query", event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <IdeaSelect all field="category" options={ideaCategories} value={filters.category} onChange={(value) => changeFilter("category", value)} />
              <IdeaSelect all field="status" options={ideaStatuses} value={filters.status} onChange={(value) => changeFilter("status", value)} />
              <IdeaSelect all field="priority" options={ideaPriorities} value={filters.priority} onChange={(value) => changeFilter("priority", value)} />
              <IdeaSelect field="sort" options={ideaSorts} value={filters.sort} onChange={(value) => changeFilter("sort", value)} />
            </div>
          </section>
          {visibleIdeas.length === 0 ? (
            <div className="space-y-3">
              <EmptyState title={t("ideas.noMatch")} description={t("ideas.noMatchHint")} />
              <button type="button" className="app-button-secondary text-sm" onClick={() => setFilters(defaultIdeaFilters)}>
                {t("common.clear")}
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {visibleIdeas.map((idea) => (
                <li key={idea.id}>
                  <button
                    type="button"
                    className="app-surface app-panel flex w-full items-start justify-between gap-3 text-left enabled:hover:border-[color:var(--border-strong)]"
                    disabled={editor !== null}
                    onClick={() => openEditor(idea)}
                  >
                    <span className="block min-w-0 space-y-2">
                      <span className="block text-base font-semibold [overflow-wrap:anywhere]">{idea.title}</span>
                      <span className="line-clamp-2 text-sm text-[color:var(--muted)] [overflow-wrap:anywhere]">{idea.content}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--muted)]">
                        <span className="rounded-full bg-[color:var(--accent-soft)] px-2 py-1 text-[color:var(--accent-ink)]">
                          {t(`ideas.category.${idea.category}`)}
                        </span>
                        <span>{t(`ideas.status.${idea.status}`)}</span>
                        <span>{t(`ideas.priority.${idea.priority}`)}</span>
                        <time dateTime={idea.createdAt}>{dateFormat.format(new Date(idea.createdAt))}</time>
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[color:var(--muted)]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
