"use client";

import { Languages } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const nextLanguage = language === "nl" ? "en" : "nl";
  const label = `${t("language.label")}: ${t(`language.${language}`)}`;

  return (
    <button
      type="button"
      onClick={() => setLanguage(nextLanguage)}
      className="app-toggle-button"
      aria-label={label}
      title={label}
    >
      <span className="inline-flex items-center gap-2">
        <Languages className="h-4 w-4 shrink-0 text-[color:var(--accent-strong)]" />
        <span>{label}</span>
      </span>
    </button>
  );
}
