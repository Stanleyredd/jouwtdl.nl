"use client";

import { Languages } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  const nextLanguage = language === "nl" ? "en" : "nl";
  const label = `${t("language.label")}: ${t(`language.${language}`)}`;

  return (
    <button
      type="button"
      onClick={() => setLanguage(nextLanguage)}
      className={cn("app-toggle-button", className)}
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
