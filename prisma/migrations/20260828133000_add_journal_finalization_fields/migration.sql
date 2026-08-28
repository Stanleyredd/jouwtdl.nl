ALTER TABLE "journal_entries"
  ADD COLUMN "finalized_at" TIMESTAMPTZ(6),
  ADD COLUMN "completion_webhook_sent_at" TIMESTAMPTZ(6);

UPDATE "journal_entries"
SET
  "finalized_at" = COALESCE("ai_summary_updated_at", "updated_at", "created_at"),
  "completion_webhook_sent_at" = COALESCE("ai_summary_updated_at", "updated_at", "created_at")
WHERE "finalized_at" IS NULL
  AND NULLIF(BTRIM("ai_summary"), '') IS NOT NULL;
