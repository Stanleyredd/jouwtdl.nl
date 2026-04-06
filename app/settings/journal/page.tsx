"use client";

import { JournalConfigEditor } from "@/components/journal-config-editor";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { translateRuntimeMessage } from "@/lib/i18n";
import { getProfileJournalConfig, getProfileJournalPreset } from "@/services/profile-service";

export default function JournalSettingsPage() {
  const {
    user,
    isReady,
    isConfigured,
    profile,
    isProfileReady,
    saveProfile,
    profileError,
  } = useAuth();
  const { language, t } = useLanguage();

  if (!isConfigured) {
    return (
      <section className="app-surface app-panel text-sm text-[color:var(--muted)]">
        {t("auth.configMissing")}
      </section>
    );
  }

  if (!user || !isReady || !isProfileReady) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow={t("settings.eyebrow")}
          title={t("settings.journalTitle")}
          description={t("common.loading")}
        />
        <section className="app-surface-strong app-panel-lg">
          <div className="h-12 rounded-[18px] bg-[color:var(--surface-soft)]" />
          <div className="mt-4 h-48 rounded-[20px] bg-[color:var(--surface-soft)]" />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.journalTitle")}
        description={t("settings.journalDescription")}
      />

      {profileError ? (
        <section className="app-surface app-panel text-sm text-[color:var(--muted)]">
          {translateRuntimeMessage(profileError, language)}
        </section>
      ) : null}

      <JournalConfigEditor
        mode="settings"
        initialPreset={getProfileJournalPreset(profile)}
        initialConfig={getProfileJournalConfig(profile, language)}
        onSave={async (input) => {
          const result = await saveProfile(input);
          return { error: result.error };
        }}
      />
    </div>
  );
}
