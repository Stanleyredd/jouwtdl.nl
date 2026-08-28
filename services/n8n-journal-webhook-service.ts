import "server-only";

const JOURNAL_WEBHOOK_TIMEOUT_MS = 5_000;

interface JournalCompletedWebhookPayload {
  event: "journal.completed";
  version: 1;
  journalEntryId: string;
  entryDate: string;
}

export interface TriggerJournalCompletedWebhookInput {
  journalEntryId: string;
  entryDate: string;
}

export async function triggerJournalCompletedWebhook(
  input: TriggerJournalCompletedWebhookInput,
) {
  const webhookUrl = process.env.N8N_JOURNAL_WEBHOOK_URL?.trim();
  const webhookSecret = process.env.N8N_JOURNAL_WEBHOOK_SECRET?.trim();

  if (!webhookUrl || !webhookSecret) {
    console.warn(
      "[n8n-journal-webhook] skipped because N8N_JOURNAL_WEBHOOK_URL or N8N_JOURNAL_WEBHOOK_SECRET is missing.",
    );
    return {
      skipped: true as const,
    };
  }

  const payload: JournalCompletedWebhookPayload = {
    event: "journal.completed",
    version: 1,
    journalEntryId: input.journalEntryId,
    entryDate: input.entryDate,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JOURNAL_WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-JouwTDL-Webhook-Secret": webhookSecret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Webhook returned status ${response.status}.`);
    }

    return {
      skipped: false as const,
    };
  } finally {
    clearTimeout(timeout);
  }
}
