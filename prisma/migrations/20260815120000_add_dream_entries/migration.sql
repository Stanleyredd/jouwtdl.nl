CREATE TABLE "dream_entries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "dream_date" DATE NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'text',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dream_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dream_entries_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "profiles"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "dream_entries_id_user_id_key"
  ON "dream_entries"("id", "user_id");

CREATE INDEX "dream_entries_user_id_idx"
  ON "dream_entries"("user_id");

CREATE INDEX "dream_entries_user_id_dream_date_idx"
  ON "dream_entries"("user_id", "dream_date");
