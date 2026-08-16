◇ injected env (6) from .env.local // tip: ⌘ override existing { override: true }
◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."daily_focuses" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "main_focus" TEXT NOT NULL DEFAULT '',
    "secondary_focuses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "daily_focuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_tasks" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "weekly_goal_id" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "life_area" TEXT NOT NULL DEFAULT '',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "carry_over_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."journal_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "entry_date" DATE NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'nl',
    "raw_transcript" TEXT NOT NULL DEFAULT '',
    "edited_transcript" TEXT NOT NULL DEFAULT '',
    "ai_summary" TEXT NOT NULL DEFAULT '',
    "ai_summary_error" TEXT,
    "ai_summary_updated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."journal_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journal_entry_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "section_key" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "journal_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monthly_goals" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "life_area" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "due_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "monthly_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "language" TEXT NOT NULL DEFAULT 'nl',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "show_tomorrow" BOOLEAN NOT NULL DEFAULT true,
    "journal_sections_enabled" JSONB NOT NULL DEFAULT '[]',
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "journal_preset" TEXT,
    "journal_config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tomorrow_setups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journal_entry_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "focus" TEXT NOT NULL DEFAULT '',
    "top_tasks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "watch_out_for" TEXT NOT NULL DEFAULT '',
    "intention" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "tomorrow_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."weekly_goals" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "monthly_goal_id" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "week_number" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "life_area" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "weekly_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_focuses_user_date_idx" ON "public"."daily_focuses"("user_id" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_focuses_user_id_date_key" ON "public"."daily_focuses"("user_id" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_tasks_id_user_id_key" ON "public"."daily_tasks"("id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "daily_tasks_user_date_idx" ON "public"."daily_tasks"("user_id" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_id_user_id_key" ON "public"."journal_entries"("id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "journal_entries_user_date_idx" ON "public"."journal_entries"("user_id" ASC, "entry_date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_user_id_entry_date_key" ON "public"."journal_entries"("user_id" ASC, "entry_date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "journal_sections_journal_entry_id_section_key_key" ON "public"."journal_sections"("journal_entry_id" ASC, "section_key" ASC);

-- CreateIndex
CREATE INDEX "journal_sections_user_entry_idx" ON "public"."journal_sections"("user_id" ASC, "journal_entry_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_goals_id_user_id_key" ON "public"."monthly_goals"("id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "monthly_goals_user_period_idx" ON "public"."monthly_goals"("user_id" ASC, "year" ASC, "month" ASC);

-- CreateIndex
CREATE INDEX "profiles_email_idx" ON "public"."profiles"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "public"."profiles"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tomorrow_setups_journal_entry_id_key" ON "public"."tomorrow_setups"("journal_entry_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tomorrow_setups_journal_entry_id_user_id_key" ON "public"."tomorrow_setups"("journal_entry_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "tomorrow_setups_user_entry_idx" ON "public"."tomorrow_setups"("user_id" ASC, "journal_entry_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_goals_id_user_id_key" ON "public"."weekly_goals"("id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "weekly_goals_user_start_idx" ON "public"."weekly_goals"("user_id" ASC, "start_date" ASC);

-- AddForeignKey
ALTER TABLE "public"."daily_focuses" ADD CONSTRAINT "daily_focuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."daily_tasks" ADD CONSTRAINT "daily_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."daily_tasks" ADD CONSTRAINT "daily_tasks_weekly_goal_fk" FOREIGN KEY ("weekly_goal_id", "user_id") REFERENCES "public"."weekly_goals"("id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."journal_entries" ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."journal_sections" ADD CONSTRAINT "journal_sections_entry_fk" FOREIGN KEY ("journal_entry_id", "user_id") REFERENCES "public"."journal_entries"("id", "user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."monthly_goals" ADD CONSTRAINT "monthly_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tomorrow_setups" ADD CONSTRAINT "tomorrow_setups_entry_fk" FOREIGN KEY ("journal_entry_id", "user_id") REFERENCES "public"."journal_entries"("id", "user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."weekly_goals" ADD CONSTRAINT "weekly_goals_monthly_goal_fk" FOREIGN KEY ("monthly_goal_id", "user_id") REFERENCES "public"."monthly_goals"("id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."weekly_goals" ADD CONSTRAINT "weekly_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

