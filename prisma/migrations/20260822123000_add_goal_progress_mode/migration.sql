ALTER TABLE "monthly_goals"
  ADD COLUMN "progress_mode" TEXT NOT NULL DEFAULT 'linked_items';

ALTER TABLE "weekly_goals"
  ADD COLUMN "progress_mode" TEXT NOT NULL DEFAULT 'linked_items';
