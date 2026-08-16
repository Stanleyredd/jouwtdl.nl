import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Local Next.js environment
config({ path: ".env.local" });

// Fallback for environments that use a regular .env file.
// Existing process environment variables are not overwritten.
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});