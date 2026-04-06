"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyTheme,
  getPreferredTheme,
  normalizeTheme,
  THEME_STORAGE_KEY,
  type AppTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  isReady: boolean;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const restoredTheme = getPreferredTheme();

    if (process.env.NODE_ENV === "development") {
      console.debug("[theme]", "current-theme-on-mount", {
        theme: "light",
        isReady: false,
      });
      console.debug("[theme]", "restored-theme-from-localStorage", {
        theme: restoredTheme,
        localStorageTheme:
          typeof window === "undefined"
            ? null
            : window.localStorage.getItem(THEME_STORAGE_KEY),
      });
    }

    applyTheme(restoredTheme);

    if (process.env.NODE_ENV === "development") {
      console.debug("[theme]", "document-theme-after-apply", {
        theme: restoredTheme,
        rootTheme: document.documentElement.dataset.theme ?? null,
      });
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(restoredTheme);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);

    if (process.env.NODE_ENV === "development") {
      const computedStyles = window.getComputedStyle(document.documentElement);

      console.debug("[theme]", "theme-after-click", {
        theme,
      });
      console.debug("[theme]", "document-theme-after-apply", {
        theme,
        rootTheme: document.documentElement.dataset.theme ?? null,
      });
      console.debug("[theme]", "dark-mode-token-set-active", {
        background: computedStyles.getPropertyValue("--background").trim(),
        surface: computedStyles.getPropertyValue("--surface").trim(),
        foreground: computedStyles.getPropertyValue("--foreground").trim(),
      });
      console.debug("[theme]", "localStorage-theme-written", {
        localStorageTheme: window.localStorage.getItem(THEME_STORAGE_KEY),
      });
    }
  }, [isReady, theme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    const normalizedTheme = normalizeTheme(nextTheme);

    if (process.env.NODE_ENV === "development") {
      console.debug("[theme]", "theme-toggle-clicked", {
        currentTheme: theme,
        nextTheme: normalizedTheme,
      });
    }

    setThemeState(normalizedTheme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [setTheme, theme]);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      isReady,
      theme,
      setTheme,
      toggleTheme,
    };
  }, [isReady, setTheme, theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
