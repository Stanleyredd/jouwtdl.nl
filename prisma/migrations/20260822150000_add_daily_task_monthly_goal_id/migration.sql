ALTER TABLE "daily_tasks"
  ADD COLUMN "monthly_goal_id" TEXT;

UPDATE "daily_tasks" AS dt
SET "monthly_goal_id" = wg."monthly_goal_id"
FROM "weekly_goals" AS wg
JOIN "monthly_goals" AS mg
  ON mg."id" = wg."monthly_goal_id"
 AND mg."user_id" = wg."user_id"
WHERE dt."weekly_goal_id" = wg."id"
  AND dt."user_id" = wg."user_id"
  AND dt."monthly_goal_id" IS NULL
  AND wg."monthly_goal_id" IS NOT NULL
  AND mg."month" = EXTRACT(MONTH FROM dt."date")::int
  AND mg."year" = EXTRACT(YEAR FROM dt."date")::int;

ALTER TABLE "daily_tasks"
  ADD CONSTRAINT "daily_tasks_monthly_goal_fk"
  FOREIGN KEY ("monthly_goal_id", "user_id")
  REFERENCES "monthly_goals"("id", "user_id")
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;
