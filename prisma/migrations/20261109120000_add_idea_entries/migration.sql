BEGIN;

CREATE TYPE "IdeaCategory" AS ENUM ('trading', 'business', 'content', 'ai_project', 'personal', 'other');
CREATE TYPE "IdeaStatus" AS ENUM ('unprocessed', 'in_progress', 'completed');
CREATE TYPE "IdeaPriority" AS ENUM ('low', 'normal', 'high');

CREATE TABLE "idea_entries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" "IdeaCategory" NOT NULL DEFAULT 'other',
  "status" "IdeaStatus" NOT NULL DEFAULT 'unprocessed',
  "priority" "IdeaPriority" NOT NULL DEFAULT 'normal',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "idea_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idea_entries_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "idea_entries_id_user_id_key" ON "idea_entries"("id", "user_id");
CREATE INDEX "idea_entries_user_id_created_at_idx" ON "idea_entries"("user_id", "created_at");

COMMIT;
