import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  // Allow generate without a live DB; migrate still requires DATABASE_URL.
  console.warn(
    "[drizzle.config] DATABASE_URL is not set. Set it before running db:migrate.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:6543/postgres",
  },
  strict: true,
  verbose: true,
});
