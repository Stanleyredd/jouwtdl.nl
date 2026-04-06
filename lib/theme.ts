export type AppTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export function normalizeTheme(value: string | null | undefined): AppTheme {
  return value === "dark" ? "dark" : "light";
}

export function getPreferredTheme() {
  if (typeof window === "undefined") {
    return "light" satisfies AppTheme;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme) {
    return normalizeTheme(storedTheme);
  }

  return "light";
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function getThemeInitScript() {
  return `
    (function () {
      try {
        var key = ${JSON.stringify(THEME_STORAGE_KEY)};
        var stored = window.localStorage.getItem(key);
        var theme = stored === "dark" ? "dark" : stored === "light" ? "light" : "light";
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
      } catch (error) {
        document.documentElement.dataset.theme = "light";
        document.documentElement.style.colorScheme = "light";
      }
    })();
  `;
}
