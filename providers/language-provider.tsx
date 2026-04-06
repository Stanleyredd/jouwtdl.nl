"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  normalizeLanguage,
  translate,
  type AppLanguage,
  type TranslationKey,
} from "@/lib/i18n";

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

const STORAGE_KEY = "clarity-system::language";
const LANGUAGE_EVENT = "clarity-system:language-change";

const LanguageContext = createContext<LanguageContextValue | null>(null);

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => callback();

  window.addEventListener(LANGUAGE_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(LANGUAGE_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function getLanguageSnapshot() {
  if (typeof window === "undefined") {
    return "nl" satisfies AppLanguage;
  }

  return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore<AppLanguage>(
    subscribe,
    getLanguageSnapshot,
    () => "nl",
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    if (typeof window === "undefined") {
      return;
    }

    const normalizedLanguage = normalizeLanguage(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, normalizedLanguage);
    document.documentElement.lang = normalizedLanguage;
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    return {
      language,
      setLanguage,
      t: (key, variables) => translate(language, key, variables),
    };
  }, [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider.");
  }

  return context;
}
