import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getThemeInitScript } from "@/lib/theme";
import { AppProvider } from "@/providers/app-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { LanguageProvider } from "@/providers/language-provider";
import { ThemeProvider } from "@/providers/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Clarity System",
  description:
    "A calm personal productivity and reflection system with structured planning, journaling, and soft AI guidance.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html
      lang="nl"
      data-scroll-behavior="smooth"
      data-theme="light"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full bg-[color:var(--background)] text-[color:var(--foreground)]">
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider initialUser={user}>
              <AppProvider>
                <AppShell>{children}</AppShell>
              </AppProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
